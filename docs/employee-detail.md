# Employee detail and salary history

Task 8 adds a read-only employee detail page reached from an employee name in the directory.

## Behavior

- The profile shows employee code, email, country, department, and job level.
- Current annual base salary is displayed in its stored currency with version and last-updated date.
- Salary history is ordered newest first by recorded timestamp and ID, and is paginated by the server with 10 rows per page in the UI.
- Revision rows show previous and new amounts, reason, HR actor, and timestamp.
- Initial rows are labeled as initialization and show `System initialization` because they have no human actor.
- Invalid identifiers return `400 VALIDATION_ERROR`; a valid UUID with no employee returns `404 EMPLOYEE_NOT_FOUND`.

The page is read-only. Salary changes are deliberately deferred to Task 9 so validation, concurrency control, and the append-only audit record can be implemented together.

## API

- `GET /api/v1/employees/:employeeId`
- `GET /api/v1/employees/:employeeId/salary-history?page=1&pageSize=25`

Both endpoints require an authenticated HR session and disable response caching. History count and rows come from one repeatable-read transaction.

## Verification

Run `npm run check` for shared contracts, component behavior, static checks, and production builds. Run `npm run test:db` for real PostgreSQL verification of detail lookup, newest-first pagination, actor serialization, invalid IDs, and missing employees.
