# ACME Salary Management

An Incubyte assessment application for managing employee annual base salaries.
**Current milestone: Task 3 database foundation.** Schema, migrations, and database tests are implemented; employee data and business features are not yet implemented.

## Local setup

Use Node.js 24 (see `.nvmrc`) and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173 for the React placeholder. The API listens on http://127.0.0.1:3001; `GET /api/v1/status` returns liveness only. The same endpoint is available through the frontend development proxy. Stop both processes with Ctrl+C.

If you change `PORT`, also update `API_PROXY_TARGET`. Keep `HOST=127.0.0.1` for local development. The UI placeholder and liveness API do not require a database. See [database setup](docs/database.md) to start PostgreSQL and apply migrations. Never place secrets in `VITE_` variables because they are exposed to the browser.

## Verification

```sh
npm run check
```

Runs workspace type checks, ESLint, formatting checks, Vitest tests, and production builds. Run `npm run test:db` separately for disposable PostgreSQL migration/constraint tests. Other commands: `npm run test:watch`, `npm run format`, and `npm run build`.

After building, run `npm start -w @acme/api` for the compiled backend, and `npm run preview -w @acme/web` to inspect frontend assets. Frontend preview does not supply an API proxy. Production same-origin serving is planned for deployment, not implemented here.

## Structure

- `apps/api`: Express application with separate server startup; API tests run without starting the production server.
- `apps/web`: React/Vite application with Material UI and TanStack Query providers.
- `packages/contracts`: reserved shared validation package with Zod; no business contracts implemented yet.
- `prisma`: schema and committed SQL migrations, including custom integrity checks.
- `scripts/database.mjs`: persistent local database and isolated integration-test runner.
- `docs`: requirements, architecture, API contracts, database guide, and actual AI workflow notes.
- `PROJECT_MEMORY.md`: feature status, approval boundaries, and append-only change history.

API tests use Vitest and Supertest. React test tooling uses jsdom and React Testing Library; feature/component tests will be added with actual UI behavior. Shared-contract tests will be added when schemas exist. No coverage percentage or business-functionality claims are made at this stage.

Read [requirements](docs/requirements.md), [architecture](docs/architecture.md), and [API design](docs/api-contracts.md) for the intended product. Each later task requires explicit user approval after review of the previous task.
