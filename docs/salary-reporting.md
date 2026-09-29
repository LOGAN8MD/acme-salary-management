# Salary reporting

Task 10 adds an HR dashboard and `GET /api/v1/reports/salaries`. The report answers a focused set of questions about current annual base salary: how many employees match the organizational filters, how many of them are paid in one selected currency, what that currency's total, average, and median are, and how those figures break down by country, department, or job level.

## Currency and calculation rules

- A report always selects exactly one of INR, USD, GBP, EUR, or JPY. Values from different currencies are never added or averaged and no exchange rates are implied.
- Country, department, and job-level filters are exact matches. The all-currency employee count applies these filters but deliberately ignores the selected currency. Every monetary statistic and group includes only employees paid in the selected currency.
- Total, average, and median use PostgreSQL `NUMERIC` values. Median is the middle value for an odd population and the exact mean of the two middle values for an even population.
- Calculations retain database precision and are rounded once for output with decimal half-up rounding: two digits for INR/USD/GBP/EUR and zero for JPY.
- Empty selected-currency results return employee count `0`, a formatted zero total, null average and median, and no groups.

The all-currency count, selected-currency summary, and groups execute sequentially in one repeatable-read transaction. This provides one consistent snapshot while respecting the interactive transaction's single database connection. Group columns come from a fixed allowlist and filter values remain parameterized.

## Dashboard behavior

The protected `/dashboard` route starts with a visible INR selection and groups by department. HR can select another supported currency, choose country/department/job-level filters, and group by country, department, or job level. Applied state is stored in the URL, so a report view can be refreshed or bookmarked.

The page labels the all-currency population separately from the selected-currency employee count. Summary cards present employee count, total, average, and median; the table presents the same metrics for each sorted group. Loading, error/retry, and empty states reuse the shared workspace components.

These results are descriptive. They do not establish pay equity because they do not control for role responsibilities, tenure, performance, location detail, or other explanatory factors.

## Deliberate boundaries

Task 10 does not add currency conversion, trends over time, charts, exports, payroll/tax calculations, pay-equity conclusions, custom group dimensions, or cached aggregates. With 10,000 employees and bounded seed-owned group dimensions, direct indexed filtering plus exact aggregation keeps the implementation clear and current. Production measurement can determine whether additional composite indexes or materialized reporting data are justified.

## Verification

Shared-contract tests cover required currency, strict parameters, defaults, and empty responses. React tests cover URL state, population labeling, metrics, and group presentation. Disposable PostgreSQL tests cover authentication, invalid inputs, currency isolation, organization filters, sorted groups, exact odd/even medians, one-time rounding, and empty selected-currency results.
