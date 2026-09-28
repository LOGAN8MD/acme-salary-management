# Employee directory

Task 7 provides a read-only directory for the 10,000 seeded employees and their current annual base salaries.

## Behavior

- Search matches a literal, case-insensitive substring of employee name or employee code.
- Country, department, job level, and currency filters combine with AND.
- Results sort by name, employee code, or annual salary. Salary sorting requires a currency so unlike currencies are never ranked together.
- The API paginates in PostgreSQL with a default page size of 25 and a maximum of 100. Every order includes employee ID as a stable tie-breaker.
- Count and page data use one repeatable-read transaction. A page beyond the last result returns an empty list.
- Filter options are sorted distinct values from the complete dataset and do not cascade.
- Filters, sort, and page are encoded in the URL so a directory view can be refreshed, bookmarked, or shared within an authenticated session.

The table formats each salary using its stored ISO currency. There is no currency conversion. This screen does not provide employee details, salary history, or salary editing.

## API

- `GET /api/v1/employees`
- `GET /api/v1/employees/filter-options`

Both endpoints require an authenticated HR session and return `Cache-Control: no-store`. Query rules and response shapes are defined in [API contracts](api-contracts.md).

## Verification

Run `npm run check` for contracts, UI behavior, type checks, lint, formatting, and builds. Run `npm run test:db` for authenticated database queries against a disposable migrated PostgreSQL instance. Manual browser review verified the complete 10,000 count, pagination, current-salary formatting, and a name/code search against the seeded local database.

The initial case-insensitive substring search may scan this 10,000-row dataset. This is the deliberate architecture choice documented before implementation; measure production-like traffic before adding trigram indexes or a search service.
