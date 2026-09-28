# Salary updates

Task 9 lets the HR manager revise an employee’s current annual base salary while preserving an append-only audit history.

## Workflow and rules

- The employee detail page opens a confirmation form showing the current currency, amount, and version.
- The new amount is a positive plain decimal string. INR, USD, GBP, and EUR allow up to two fractional digits; JPY accepts whole amounts only. Numbers, commas, symbols, signs, and exponent notation are rejected.
- Amounts can contain at most 16 whole digits, matching PostgreSQL `NUMERIC(18,2)`. The API normalizes successful responses to two stored decimal places.
- A trimmed reason of 3–500 characters is mandatory. Currency, actor, and effective date cannot be supplied by the client.
- The client sends the version it displayed. If another update wins first, the API returns `409 SALARY_VERSION_CONFLICT`, refreshes employee data, and asks the manager to review it.
- An unchanged amount returns `400 SALARY_UNCHANGED`. Version conflict takes precedence so stale clients first see the latest state.
- Current salary and its `REVISION` history entry are written in one database transaction. The history actor always comes from the authenticated session.

The UI does not claim success optimistically and does not retry mutations automatically. After a connection failure with no response, it describes the outcome as uncertain and asks the manager to refresh before trying again. After success it refreshes directory, detail, history, and future report queries and resets history to the newest page.

## API

`PATCH /api/v1/employees/:employeeId/salary`

The endpoint requires an authenticated session, the configured request origin, and `X-CSRF-Token`. Request and response shapes are documented in [API contracts](api-contracts.md).

## Verification

Run `npm run check` for shared validation, UI behavior, type checks, lint, formatting, and builds. Run `npm run test:db` for real PostgreSQL verification of exact writes, actor attribution, conflict precedence, JPY precision, concurrent writers, and rollback when history insertion fails.
