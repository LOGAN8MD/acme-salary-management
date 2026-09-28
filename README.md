# ACME Salary Management

An Incubyte assessment application for managing employee annual base salaries.
**Current milestone: Task 2 foundation only.** Database and business features are not implemented.

## Local setup

Use Node.js 24 (see `.nvmrc`) and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173 for the React placeholder. The API listens on http://127.0.0.1:3001; `GET /api/v1/status` returns liveness only. The same endpoint is available through the frontend development proxy. Stop both processes with Ctrl+C.

If you change `PORT`, also update `API_PROXY_TARGET`. Keep `HOST=127.0.0.1` for local development. No database or credentials are needed for this milestone. Never place secrets in `VITE_` variables because they are exposed to the browser.

## Verification

```sh
npm run check
```

Runs workspace type checks, ESLint, formatting checks, Vitest tests, and production builds. Other commands: `npm run test:watch`, `npm run format`, and `npm run build`.

After building, run `npm start -w @acme/api` for the compiled backend, and `npm run preview -w @acme/web` to inspect frontend assets. Frontend preview does not supply an API proxy. Production same-origin serving is planned for deployment, not implemented here.

## Structure

- `apps/api`: Express application with separate server startup; API tests run without starting the production server.
- `apps/web`: React/Vite application with Material UI and TanStack Query providers.
- `packages/contracts`: reserved shared validation package with Zod; no business contracts implemented yet.
- `docs`: requirements, architecture, initial API contracts, and actual AI workflow notes.
- `PROJECT_MEMORY.md`: feature status, approval boundaries, and append-only change history.

API tests use Vitest and Supertest. React test tooling uses jsdom and React Testing Library; feature/component tests will be added with actual UI behavior. Shared-contract tests will be added when schemas exist. No coverage percentage or business-functionality claims are made at this stage.

Read [requirements](docs/requirements.md), [architecture](docs/architecture.md), and [API design](docs/api-contracts.md) for the intended product. Each later task requires explicit user approval after review of the previous task.
