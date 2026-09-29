# AI workflow evidence

This log records work actually performed with Codex, not hypothetical prompts or fabricated development steps.

## Task 1 — Requirements and design

User instruction: `implement task 1`.

Codex read project memory and authored requirements, architecture, and initial API contracts. Decisions included exact decimal salary storage, currency-isolated reports, transactional history, and stale-version protection. Local checks validated Markdown links and fenced JSON examples. The user then authorized Task 2.

## Task 2 — Foundation

User instruction: `implement task 2`.

Codex read project memory, recorded the pending scope, and initialized Git with the documentation baseline before adding application code. The foundation uses npm workspaces, strict TypeScript, React/Vite, Express, ESLint, Prettier, and Vitest. Dependency versions are resolved through npm and recorded in the lockfile.

A small liveness endpoint supports setup verification without falsely claiming database readiness. The UI explicitly states that salary features are not implemented. No employee data, salary calculations, authentication, or database implementation is included in this task.

Verification results are recorded in PROJECT_MEMORY.md after execution. Task 3 remains subject to separate user approval.

## Task 3 — Database and migrations

User instruction: `implement task 3`.

Codex read project memory and recorded pending scope before changes. It checked Prisma's official documentation and npm versions, pinned stable Prisma 7.10.0, and created schema plus separate SQL checks. With no PostgreSQL installation available, it added a development-only embedded PostgreSQL runtime and an isolated integration-test runner. The real database tests cover exact money, relational constraints, history shape, and rollback. Schema/SQL review explicitly distinguishes storage checks from future service invariants and notes PostgreSQL's scale rounding. Dependency audit findings prompted patched transitive overrides, followed by repeated migration and test verification. No seed dataset or feature endpoints were added.

## Task 4 — Deterministic seeding

User instruction: `implement task 4`.

Codex read memory/schema/database instructions and recorded the pending change before coding. It designed a fixed generator using reserved test emails, deterministic IDs/dates, and BigInt minor-unit arithmetic. The seed uses a single transaction and a lock to serialize invocations. Review focused on preserving evaluator salary/password changes, rejecting partial data, and separating deterministic data from randomized password salts. Node/OWASP documentation informed the scrypt parameters.

Tests exercise the full 10,000-row dataset, coherent histories, two concurrent seed calls, a later salary edit, rejection of inconsistent/unrelated records, and injected failure rollback. Adding type checks for CLI/config files exposed an unsupported per-project Vitest option from Task 2, which was removed. No auth endpoints or UI were added. Local seeding and a no-op rerun were verified; final results are recorded in project memory.

## Task 5 — Authentication

User instruction: `implement task 5`; later `try again` authorized retrying verification after an automatic approval-review usage-limit failure.

Codex implemented database-backed opaque sessions, seed-compatible password verification, CSRF/origin checks, cookie flags, request throttling, shared auth schemas, and a React login/session view. Test review caught a cache-clearing bug that detached the active auth observer; the fix preserves the auth query while clearing other cached data. All 21 database tests and 15 unit/API/component/contract tests passed after the fix. Browser verification confirmed local demo login, persistence after reload, and logout. The server was reused after detecting that development ports were already occupied by this project. Authentication behavior and single-instance rate-limit limitations are documented separately. No Task 6 navigation or business screens were implemented.

## Task 6 — Application layout and protected navigation

User instruction: `implement task 6`; later `try again` requested completion after the interrupted attempt.

Codex added React Router routes, a shared session hook, protected-route handling, a responsive Material UI workspace, and reusable presentation components. The implementation constrains post-login return paths to known internal pages and clears feature-query data when the session becomes anonymous. Dashboard and Employees remain explicit placeholders so the UI does not imply unimplemented business behavior.

Type checking found invalid responsive Stack props and component-test typing issues; both were corrected. A session test also exposed reuse of a consumed mock response, which was changed to return a fresh response per request. The final check passed 23 unit/API/component/contract tests, type checks, lint, formatting, and production builds. Manual browser verification covered direct protected access, post-login return, desktop navigation, mobile drawer behavior, reload persistence, and sign-out availability. Vite still reports the previously documented frontend chunk-size advisory; route-level splitting remains a later optimization.

## Task 7 — Employee directory

User instruction: `implement task 7`.

Codex translated the approved API contract into shared Zod query/response schemas, an authenticated Prisma service/router, and a URL-backed React directory. Count and page retrieval use one repeatable-read transaction; sorting is allowlisted with an ID tie-breaker, and salary sorting requires one currency. The UI uses server pagination, retains prior page data during transitions, formats stored currencies without conversion, and exposes loading, empty, and retry states.

TypeScript and ESLint identified exact-optional-property and effect-driven state issues; conditional props and a URL-keyed content boundary resolved them. The first database run correctly exposed an obsolete Task 5 expectation that authenticated employee routes returned 404; it was updated to assert the now-implemented empty directory while preserving report-route protection. Final verification passed the standard test suite and 24 disposable PostgreSQL tests. Browser review confirmed all 10,000 seeded employees, pagination, salary formatting, and search for a specific employee code.

## Task 8 — Employee detail and salary history

User instruction: `implement task 8`.

Codex extended the shared contracts and existing employee module rather than creating a separate service boundary. The API validates UUIDs and pagination, distinguishes malformed and missing employees, serializes exact decimal values, and reads history count plus rows in a repeatable-read transaction. The protected React route presents profile data, current salary version, and a newest-first history table with clear initialization labels.

The implementation kept salary mutation out of this milestone so validation, concurrency, and atomic audit writes remain one cohesive Task 9 change. Component verification caught a locale-specific currency expectation; the assertion was aligned with the test runtime while retaining currency-format coverage. Database tests cover detail lookup, revision actors, history pagination/order, invalid IDs, and missing employees.

## Task 9 — Transactional salary updates

User instruction: `implement task 9`.

Codex implemented strict shared mutation contracts, session-derived actor identity, CSRF-protected HTTP handling, and a conditional version update plus history insertion in one Prisma transaction. Validation uses the stored currency, preserves exact decimals, rejects unchanged values, and checks version conflicts before amount equality. The React form shows the version being changed, requires a reason, avoids mutation retries and optimistic success, refreshes affected queries, and distinguishes server rejection from an uncertain connection outcome.

Tests exercise rejected representations, unknown fields, successful exact writes, actor attribution, stale-before-unchanged precedence, JPY precision, two concurrent writers, and forced history-insert rollback. Component tests verify that invalid forms do not issue a mutation and that valid submission obtains CSRF before showing success. Live browser review confirmed the current salary/version context and accessible validation without modifying the seeded record.

## Task 10 — Salary reporting dashboard

User instruction: `implement task 10`.

Codex implemented strict report query/response contracts, an authenticated report module, and the protected dashboard. Product decisions keep monetary aggregates within one explicitly selected currency, show the organization-filtered all-currency population separately, and avoid pay-equity conclusions. The API calculates totals, averages, and exact odd/even medians from PostgreSQL decimals, rounds once at display precision, allows only fixed group columns, and reads every report section from one repeatable-read snapshot.

The first database run exposed two integration issues: an older auth test still expected the report route to be absent, and parallel raw statements on one interactive transaction connection stalled an unfiltered report. The implementation now executes those statements sequentially within the same snapshot and handles an empty organization-filter list without calling Prisma's empty SQL join. Disposable tests then verified currency isolation, filters, group ordering, medians, JPY rounding, and empty results. The React dashboard keeps applied filters in the URL and clearly labels which counts include all currencies.

## Task 11 — End-to-end quality and performance verification

User instruction: `implement task 11`.

Codex added Playwright and a dedicated quality runner that creates a temporary PostgreSQL cluster, applies the committed migrations, seeds the full deterministic dataset, and starts the real API and web application on available ports. The browser journey signs in, finds one employee, applies an attributed salary revision, checks history, verifies the report refresh, and signs out. Accessible selectors and focus assertions cover the critical keyboard and labeling behavior. The runner always removes its database, so the test cannot alter local demo data.

A separate repeatable command measured directory, detail, and report HTTP responses through the Vite proxy with five concurrent requests. Each case used five warm-ups and 50 measured samples. On the recorded Apple M4 environment, p95 results were 11.15 ms, 4.25 ms, and 9.78 ms respectively; these are local engineering evidence rather than production guarantees. GitHub Actions now runs standard, database, and browser checks for pull requests and pushes to `main`.

## Task 12 — Production packaging and deployment readiness

User instruction: `implement task 12`.

Codex converted the compiled Express service into the production entry point for both API and React assets, added a database-backed readiness endpoint, bounded reverse-proxy configuration, security headers, and startup configuration validation. It added a multi-stage Docker image, a Render Blueprint with pre-deploy migrations and a one-time initial seed hook, and a read-only deployment smoke journey. Official Render documentation was checked for Blueprint fields, Docker services, health checks, private PostgreSQL connections, and Prisma migration placement.

The local production command creates a disposable database, builds the repository, starts only compiled output, and verifies same-origin routing and the HR read journey. No public deployment is claimed because this workspace has no Git remote or hosting credentials; external publication and demo/submission materials remain delivery work.

## Task 13 — Final delivery, demo, and submission

User instruction: `implement task 13`.

Codex audited the implementation against the assessment requirements, corrected stale documentation, and added reviewer and submission guides. It created a reproducible Playwright video workflow rather than recording against mutable local or hosted data: the command provisions an isolated database, seeds the full dataset, performs the primary HR journey, writes a WebM artifact, and removes the temporary database.

External publication is attempted only through available authenticated tooling. Repository, deployment, video-upload, and email statuses are recorded separately so locally completed delivery work is not presented as a public deployment.
