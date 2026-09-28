# ACME Salary Management — Initial API Contracts

**Date:** 2026-09-28 · **Status:** Authentication endpoints implemented in Task 5; remaining feature endpoints are planned. See project memory for current status.

Base path: `/api/v1`. Requests and responses use JSON except `204` responses. IDs are UUID strings; timestamps use ISO 8601 UTC. Salary amounts are plain decimal strings, never JSON numbers or exponent notation. Employee currencies are server-owned. Unknown body fields and unsupported query values are rejected.

## Endpoint inventory

| Endpoint (relative to base path)        | Method | Purpose                                                       | Used by                                   | Authentication                              |
| --------------------------------------- | ------ | ------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `/health`                               | GET    | Application/database readiness                                | Hosting health check                      | Public                                      |
| `/auth/csrf`                            | GET    | Obtain session-bound CSRF token                               | Login and authenticated UI initialization | Public; creates anonymous session if needed |
| `/auth/login`                           | POST   | Authenticate and rotate session                               | Login screen                              | Anonymous session + CSRF                    |
| `/auth/me`                              | GET    | Read signed-in HR user                                        | Protected routes/header                   | Required                                    |
| `/auth/logout`                          | POST   | Revoke session                                                | Header                                    | Required + CSRF                             |
| `/employees/filter-options`             | GET    | Read available countries, departments, levels, and currencies | Directory/dashboard                       | Required                                    |
| `/employees`                            | GET    | Search, filter, sort, paginate employees                      | Directory                                 | Required                                    |
| `/employees/:employeeId`                | GET    | Read employee and current salary                              | Employee detail                           | Required                                    |
| `/employees/:employeeId/salary-history` | GET    | Read paginated history                                        | Employee detail                           | Required                                    |
| `/employees/:employeeId/salary`         | PATCH  | Change salary and append history atomically                   | Salary form                               | Required + CSRF                             |
| `/reports/salaries`                     | GET    | Read employee counts and currency-specific summary/breakdown  | Dashboard                                 | Required                                    |

All authenticated responses use `Cache-Control: no-store`. Mutations require `X-CSRF-Token`. There are no employee CRUD, currency-edit, history-edit, or history-delete endpoints.

## Common errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the supplied values.",
    "details": [
      { "field": "annualBaseAmount", "message": "Must be positive." }
    ],
    "requestId": "request-identifier"
  }
}
```

`details` is optional and intended for validation errors. Never expose stack traces, SQL, hashes, tokens, or credentials.

| HTTP status | Code                      | Meaning                                                            |
| ----------- | ------------------------- | ------------------------------------------------------------------ |
| 400         | `VALIDATION_ERROR`        | Malformed JSON, IDs, query parameters, or invalid fields           |
| 401         | `UNAUTHENTICATED`         | Missing/expired authenticated session                              |
| 401         | `INVALID_CREDENTIALS`     | Login failed; same response for unknown email and wrong password   |
| 403         | `CSRF_INVALID`            | Missing/invalid token or rejected origin                           |
| 404         | `EMPLOYEE_NOT_FOUND`      | Well-formed employee ID does not exist                             |
| 409         | `SALARY_VERSION_CONFLICT` | Employee salary changed since it was loaded                        |
| 422         | `SALARY_UNCHANGED`        | Submitted amount equals current amount after decimal normalization |
| 429         | `RATE_LIMITED`            | Too many login attempts; include `Retry-After`                     |
| 500         | `INTERNAL_ERROR`          | Unexpected failure; no partial salary update persists              |
| 503         | `NOT_READY`               | Health check cannot reach the database                             |

## Health and authentication

`GET /health` → `200 {"status":"ok"}` if application/database are ready; otherwise `503` with the common error envelope. Do not expose infrastructure details.

`GET /auth/csrf` → `200 {"data":{"csrfToken":"opaque-token"}}`. Sets an anonymous session cookie if necessary; otherwise returns a token bound to the existing session. Tokens must not appear in URLs or logs.

`POST /auth/login` body:

```json
{ "email": "hr@example.test", "password": "user-entered-password" }
```

Validate email and nonempty password; return `200` with the following shape and a rotated session cookie/token:

```json
{
  "data": {
    "user": {
      "id": "00000000-0000-4000-8000-000000000001",
      "email": "hr@example.test",
      "role": "HR_MANAGER"
    },
    "csrfToken": "new-opaque-token"
  }
}
```

`GET /auth/me` → `200 {"data":{"user":{...}}}` with the same user shape. `POST /auth/logout` has no body, returns `204`, and clears/revokes the session. A later `/auth/me` returns `401`. UI initialization can fetch `/auth/csrf` again after reload. Cookie lifetime and security are specified in [architecture](architecture.md).

## Employee response model

The directory and detail endpoint share this shape:

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "employeeCode": "ACME-000010",
  "name": "Asha Rao",
  "email": "asha.rao@example.test",
  "countryCode": "IN",
  "department": "Engineering",
  "jobLevel": "L2",
  "salary": {
    "annualBaseAmount": "1800000.00",
    "currencyCode": "INR",
    "version": 2,
    "updatedAt": "2026-09-01T10:00:00.000Z"
  }
}
```

`GET /employees/:employeeId` → `200 {"data": Employee}`. Examples use illustrative synthetic values; they are not actual seeded records or credentials.

## Employee directory

`GET /employees` query parameters:

| Parameter      | Rule / default                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `search`       | Optional trimmed text, maximum 100 characters; literal case-insensitive substring match on name or employee code; blank means no search |
| `countryCode`  | Optional exact supported country code                                                                                                   |
| `department`   | Optional exact canonical department                                                                                                     |
| `jobLevel`     | Optional exact canonical level                                                                                                          |
| `currencyCode` | Optional supported currency                                                                                                             |
| `page`         | Integer ≥ 1; default 1                                                                                                                  |
| `pageSize`     | Integer 1–100; default 25                                                                                                               |
| `sortBy`       | `name`, `employeeCode`, or `annualBaseAmount`; default `name`; amount sorting requires `currencyCode`                                   |
| `sortOrder`    | `asc` or `desc`; default `asc`                                                                                                          |

Filters combine with AND. Search treats `%` and `_` as literal characters. Use a stable ascending ID tie-breaker and parameterized/allowlisted queries. A page past the last result returns an empty array, not an error.

Response: `200 {"data":[Employee],"pagination":{"page":1,"pageSize":25,"totalItems":10000,"totalPages":400}}`. For zero matches, `totalItems` and `totalPages` are zero. Count and page data should come from a consistent read snapshot. Offset pagination is acceptable for this dataset; results may move across separate page requests if data changes.

`GET /employees/filter-options` → `200`:

```json
{
  "data": {
    "countryCodes": ["GB", "IN", "JP", "US"],
    "departments": ["Engineering", "Finance"],
    "jobLevels": ["L1", "L2", "L3"],
    "currencyCodes": ["EUR", "GBP", "INR", "JPY", "USD"]
  }
}
```

Return sorted distinct values from the complete dataset; options do not cascade with current filters. Values above illustrate the response shape, not an exhaustive seed specification.

## Salary history

`GET /employees/:employeeId/salary-history?page=1&pageSize=25` uses the directory's pagination limits/envelope and orders by timestamp descending, then ID descending. `data` is an array of:

```json
{
  "id": "00000000-0000-4000-8000-000000000020",
  "kind": "REVISION",
  "previousAmount": "1700000.00",
  "newAmount": "1800000.00",
  "currencyCode": "INR",
  "reason": "Annual salary review",
  "changedBy": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "hr@example.test"
  },
  "salaryVersion": 2,
  "recordedAt": "2026-09-01T10:00:00.000Z"
}
```

`INITIAL` entries have `previousAmount: null`, `changedBy: null`, `salaryVersion: 1`, and a seed-initialization reason. They must be labeled as initialization in the UI.

## Salary update

`PATCH /employees/:employeeId/salary` body:

```json
{
  "annualBaseAmount": "1900000.00",
  "reason": "Promotion to expanded responsibilities",
  "expectedVersion": 2
}
```

- Amount must be a positive plain decimal string within the database bounds, with no excess fractional digits for the employee's stored currency. Whole amounts such as `"1900000"` are allowed and normalized in the response. Reject negative/zero values, commas, exponents, currency symbols, and JSON numbers.
- `reason`: trimmed, 3–500 characters. `expectedVersion`: positive integer.
- Reject unknown fields such as `currencyCode`, `changedBy`, or `effectiveDate`.
- On success: `200 {"data":{"salary": Salary,"change": SalaryChange}}`, using the models above; the example update produces salary version 3 and a revision from `1800000.00` to `1900000.00`.
- On a stale version: `409 SALARY_VERSION_CONFLICT`; UI refetches detail/history and asks the user to review before resubmitting. Version conflict takes precedence over unchanged-amount validation.
- A failure rolls back both writes. There is no automatic retry of salary mutations; after uncertain network failure the UI checks current state first.

## Salary reports

`GET /reports/salaries?currencyCode=INR&groupBy=department`

Required `currencyCode`: INR, USD, GBP, EUR, or JPY. Optional `countryCode`, `department`, and `jobLevel` follow the directory's exact-match rules. `groupBy` is `countryCode`, `department`, or `jobLevel`, defaulting to `department`. Search and directory pagination are not report parameters.

Illustrative response:

```json
{
  "data": {
    "currencyCode": "INR",
    "groupBy": "department",
    "filters": { "countryCode": null, "department": null, "jobLevel": null },
    "matchingEmployeeCountAllCurrencies": 10,
    "summary": {
      "employeeCount": 2,
      "totalAnnualBaseAmount": "3600000.00",
      "averageAnnualBaseAmount": "1800000.00",
      "medianAnnualBaseAmount": "1800000.00"
    },
    "groups": [
      {
        "key": "Engineering",
        "employeeCount": 2,
        "totalAnnualBaseAmount": "3600000.00",
        "averageAnnualBaseAmount": "1800000.00",
        "medianAnnualBaseAmount": "1800000.00"
      }
    ]
  }
}
```

The all-currency count applies organizational filters but ignores the required monetary currency selection. Summary and groups include only the selected currency; label this distinction in the UI. Groups are sorted by key ascending. Empty selected-currency results return count 0, currency-formatted zero total, `null` average/median, and `groups: []`.

Do not paginate the bounded seed-owned grouping dimensions. Compute all report sections using a consistent database snapshot. Calculations and rounding follow the architecture document; the UI must not recompute aggregates from directory pages.

## Contract verification during implementation

Cover authentication/CSRF failures, malformed inputs, decimal precision and bounds, empty/past-end pagination, unknown employees, consistent filter definitions, deterministic ordering, unchanged/stale salary writes, rollback, and currency-isolated reporting. Test known odd/even-count medians and empty datasets. These are planned checks, not tests already implemented or executed.
