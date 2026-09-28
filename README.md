# ACME Salary Management

An Incubyte assessment application for managing employee annual base salaries.
**Current milestone: Task 7 employee directory.** The authenticated, responsive workspace now provides server-paginated search, filters, sorting, and current salary summaries for the 10,000 seeded employees. Employee details, salary changes, and reporting remain pending.

## Local setup

Use Node.js 24 (see `.nvmrc`) and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173 for the HR login screen. See [authentication review](docs/authentication.md) for demo credentials and session behavior, [application layout](docs/layout.md) for protected routes, and [employee directory](docs/employee-directory.md) for query behavior and boundaries. The API listens on http://127.0.0.1:3001; `GET /api/v1/status` returns liveness only. The same endpoint is available through the frontend development proxy. Stop both processes with Ctrl+C.

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
- `packages/contracts`: shared Zod authentication and employee-directory query/response schemas; salary-update contracts remain pending.
- `prisma`: schema, committed SQL migrations, and seed entry point.
- `scripts/database.mjs`: persistent local database and isolated integration-test runner.
- `docs`: requirements, architecture, API contracts, database/auth/layout/directory guides, and actual AI workflow notes.
- `PROJECT_MEMORY.md`: feature status, approval boundaries, and append-only change history.

API tests use Vitest and Supertest. React component tests cover session restore, login/logout, routing, navigation, responsive behavior, shared UI states, and employee-directory URL/search behavior. Shared-contract tests cover strict authentication and directory validation. Disposable PostgreSQL tests cover directory authorization, filters, salary sorting, pagination, and options. No coverage percentage claim is made.

Read [requirements](docs/requirements.md), [architecture](docs/architecture.md), and [API design](docs/api-contracts.md) for the intended product. Each later task requires explicit user approval after review of the previous task.
