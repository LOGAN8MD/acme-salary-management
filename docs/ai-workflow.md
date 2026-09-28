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
