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
