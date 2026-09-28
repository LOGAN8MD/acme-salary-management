# ACME Salary Management

An Incubyte assessment application for managing employee annual base salaries.
**Current milestone: Task 9 transactional salary updates.** The authenticated workspace provides the 10,000-employee directory, profile/history pages, and concurrency-safe salary revisions with mandatory reasons and atomic audit entries. Reporting remains pending.

## Local setup

Use Node.js 24 (see `.nvmrc`) and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173 for the HR login screen. See [authentication review](docs/authentication.md) for demo credentials, [employee directory](docs/employee-directory.md) for search behavior, [employee detail](docs/employee-detail.md) for profile/history behavior, and [salary updates](docs/salary-updates.md) for mutation rules. The API listens on http://127.0.0.1:3001; `GET /api/v1/status` returns liveness only. The same endpoint is available through the frontend development proxy. Stop both processes with Ctrl+C.

If you change `PORT`, also update `API_PROXY_TARGET`. Keep `HOST=127.0.0.1` for local development. The API now requires the migrated PostgreSQL database at startup. See [database setup](docs/database.md) to start PostgreSQL and apply migrations, then [seeding instructions](docs/seeding.md) to populate the demo dataset. Never place secrets in `VITE_` variables because they are exposed to the browser.

## Verification

```sh
npm run check
```

Runs workspace type checks, ESLint, formatting checks, Vitest tests, and production builds. Run `npm run test:db` separately for disposable PostgreSQL migration/constraint tests. Other commands: `npm run test:watch`, `npm run format`, and `npm run build`.

After building, run `npm start -w @acme/api` for the compiled backend, and `npm run preview -w @acme/web` to inspect frontend assets. Frontend preview does not supply an API proxy. Production same-origin serving is planned for deployment, not implemented here.

## Structure

- `apps/api`: Express application with separate server startup; API tests run without starting the production server.
- `apps/web`: React login/session UI, protected routing, responsive workspace shell, and shared presentation components.
- `packages/contracts`: shared Zod authentication, employee, history, and salary-update contracts.
- `prisma`: schema, committed SQL migrations, and seed entry point.
- `scripts/database.mjs`: persistent local database and isolated integration-test runner.
- `docs`: requirements, architecture, API contracts, database/auth/layout/directory guides, and actual AI workflow notes.
- `PROJECT_MEMORY.md`: feature status, approval boundaries, and append-only change history.

API tests use Vitest and Supertest. React component tests cover session/navigation, directory behavior, employee detail/history, salary form validation, CSRF submission, and success feedback. Shared-contract tests cover authentication, employee queries, and strict salary input. Disposable PostgreSQL tests cover reads plus atomic salary/history writes, conflicts, currency precision, concurrent writers, and rollback. No coverage percentage claim is made.

Read [requirements](docs/requirements.md), [architecture](docs/architecture.md), and [API design](docs/api-contracts.md) for the intended product. Each later task requires explicit user approval after review of the previous task.
