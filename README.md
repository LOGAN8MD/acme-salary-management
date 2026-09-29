# ACME Salary Management

An Incubyte assessment application for managing employee annual base salaries.
**Current milestone: Task 13 final delivery.** The authenticated workspace provides the 10,000-employee directory, profile/history pages, concurrency-safe salary revisions, and currency-isolated salary summaries. The compiled Node service serves the React application and API from one production origin, with database readiness checks and repeatable deployment verification.

## Local setup

Use Node.js 24 (see `.nvmrc`) and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173 for the HR login screen. See [authentication review](docs/authentication.md) for demo credentials, [employee directory](docs/employee-directory.md) for search behavior, [employee detail](docs/employee-detail.md) for profile/history behavior, [salary updates](docs/salary-updates.md) for mutation rules, and [salary reporting](docs/salary-reporting.md) for dashboard calculations. The API listens on http://127.0.0.1:3001; `GET /api/v1/status` returns liveness only. The same endpoint is available through the frontend development proxy. Stop both processes with Ctrl+C.

If you change `PORT`, also update `API_PROXY_TARGET`. Keep `HOST=127.0.0.1` for local development. The API now requires the migrated PostgreSQL database at startup. See [database setup](docs/database.md) to start PostgreSQL and apply migrations, then [seeding instructions](docs/seeding.md) to populate the demo dataset. Never place secrets in `VITE_` variables because they are exposed to the browser.

## Verification

```sh
npm run check
```

Runs workspace type checks, ESLint, formatting checks, Vitest tests, and production builds. Run `npm run test:db` separately for disposable PostgreSQL migration/constraint tests. Other commands: `npm run test:watch`, `npm run format`, and `npm run build`.

Install the Playwright Chromium runtime once with `npx playwright install chromium`, then run `npm run test:e2e` for the isolated critical browser journey. Run `npm run test:performance` for a reproducible five-concurrent-request measurement against a temporary 10,000-employee database. See [quality verification](docs/quality-verification.md) for scope, latest results, and limitations.

Run `npm run demo:record` to generate a reviewable WebM walkthrough under `.artifacts/demo/`. See the [reviewer guide](docs/reviewer-guide.md), [demo guide](docs/demo-guide.md), and [submission checklist](docs/submission.md) for the final assessment package.

Run `npm run test:production` to build and verify the compiled single-origin application against an isolated seeded database. After a normal build, root `npm start` launches that production service. See [production deployment](docs/deployment.md) for required environment variables, migrations, the native Node Render blueprint, and external smoke testing.

## Structure

- `apps/api`: Express application with separate server startup; API tests run without starting the production server.
- `apps/web`: React login/session UI, protected routing, responsive workspace shell, and shared presentation components.
- `packages/contracts`: shared Zod authentication, employee, history, salary-update, and reporting contracts.
- `prisma`: schema, committed SQL migrations, and seed entry point.
- `scripts/database.mjs`: persistent local database and isolated integration-test runner.
- `render.yaml`: native Node web service and managed PostgreSQL deployment blueprint.
- `e2e`: Playwright critical-journey coverage against an isolated full stack.
- `docs`: requirements, architecture, API contracts, feature guides, quality evidence, and actual AI workflow notes.
- `PROJECT_MEMORY.md`: feature status, approval boundaries, and append-only change history.

API tests use Vitest and Supertest. React component tests cover session/navigation, directory behavior, employee detail/history, salary updates, and report presentation. Shared-contract tests cover authentication, employee queries, strict salary input, and report parameters/responses. Disposable PostgreSQL tests cover reads, atomic salary/history writes, conflicts/rollback, and currency-isolated report statistics including exact odd/even medians. Playwright covers the complete login-to-update-to-report journey. No coverage percentage claim is made.

Read [requirements](docs/requirements.md), [architecture](docs/architecture.md), and [API design](docs/api-contracts.md) for the intended product. Each later task requires explicit user approval after review of the previous task.
