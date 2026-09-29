# Production deployment

Task 12 packages the application as one production service: Express serves `/api/v1` and the compiled React application from the same HTTPS origin. This keeps session cookies and CSRF origin checks simple. Static files under `/assets` receive immutable caching; the HTML entry document is not cached. Unknown extensionless browser routes return the entry document, while API and missing-file requests keep their JSON/404 behavior.

## Production verification

Run the complete local production check:

```sh
npm run test:production
```

The command builds every workspace, creates an isolated PostgreSQL cluster, applies committed migrations, seeds 10,000 employees, starts the compiled Node service with `NODE_ENV=production`, and runs a read-only HTTP smoke test. It verifies status, database readiness, security headers, the SPA entry point, immutable asset caching, authentication, exact employee lookup, reporting, and logout. The temporary database is removed afterward.

To smoke-test an already deployed service without changing salary data:

```sh
DEPLOYMENT_URL=https://your-service.example \
DEPLOYMENT_SMOKE_PASSWORD='your-seeded-password' \
npm run test:deployment
```

## Environment variables

| Variable                    | Required production value                                           |
| --------------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`                  | `production`                                                        |
| `DATABASE_URL`              | Private managed PostgreSQL connection string                        |
| `APP_ORIGIN`                | Exact public HTTPS origin, with no path or trailing slash           |
| `HOST`                      | Usually `0.0.0.0` on the hosting service                            |
| `PORT`                      | Hosting-provider port; defaults to `3001`                           |
| `TRUST_PROXY_HOPS`          | Number of trusted reverse-proxy hops; the Render blueprint uses `1` |
| `SEED_HR_PASSWORD`          | Strong secret used only by the explicit production seed command     |
| `DEPLOYMENT_URL`            | Smoke-test target only                                              |
| `DEPLOYMENT_SMOKE_PASSWORD` | Smoke-test login only; may equal `SEED_HR_PASSWORD`                 |

Do not expose secrets through `VITE_` variables. Proxy trust is deliberately numeric and bounded; configure it to the known hosting topology rather than accepting arbitrary forwarded headers.

## Database release procedure

Every release runs `npm run db:migrate` before the Node process starts. The supplied free-tier Render service performs this idempotent command in its platform start command because Render reserves dedicated pre-deploy commands for paid web services. The application code itself never creates schema or seed data during startup. For the first environment only, run:

```sh
npm run db:seed:production
```

The production seed imports compiled application code, requires `SEED_HR_PASSWORD`, and has the same safe rerun behavior as the local seed: it accepts the complete known dataset and refuses partial or unrelated data. Do not run it as a routine deploy step after initialization.

Back up the managed database and verify restoration according to the provider's retention plan before a schema release. Migrations are forward-only: if an application release must be rolled back, redeploy the prior commit only when its code remains compatible with the migrated schema. Otherwise, issue a reviewed corrective migration; never edit an applied migration.

## Native Node service

The production service uses the same Node.js 24 runtime and npm commands as local verification:

```sh
npm ci --include=dev
npm run build
npm prune --omit=dev --ignore-scripts
npm run db:migrate
npm start
```

Render supplies `PORT`; the production configuration defaults `HOST` to `0.0.0.0`. The build command installs locked dependencies, builds every workspace, and prunes development dependencies. The start command applies committed migrations before starting the compiled service. Database seeding remains a separate one-time command.

## Render Blueprint

`render.yaml` defines one native Node web service and one private PostgreSQL database in Singapore. The free plan is selected so importing the blueprint does not silently choose a paid tier; review current capacity and availability limits before using it for a real organization.

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Render, create a Blueprint from the repository and review the proposed resources.
3. Supply `APP_ORIGIN` using the final Render service URL and a strong `SEED_HR_PASSWORD` when prompted.
4. Let the platform start command apply migrations and start the compiled service. The initial-deploy hook seeds the first environment once.
5. Confirm `/api/v1/health`, then run `npm run test:deployment` with the final URL and password.

The configuration follows Render's official [Blueprint specification](https://render.com/docs/blueprint-spec), [native runtime](https://render.com/docs/native-runtimes), [deployment pipeline](https://render.com/docs/deploys), [health-check](https://render.com/docs/health-checks), and [PostgreSQL connection](https://render.com/docs/postgresql-creating-connecting) guidance. Prisma migrations still use the committed `migrate deploy` workflow described in Render's [Prisma deployment guide](https://render.com/docs/deploy-prisma-orm).

## Current release status

The application is live at [acme-salary-management-26x6.onrender.com](https://acme-salary-management-26x6.onrender.com) as a free native Node service backed by private Render PostgreSQL. The database contains the complete synthetic dataset and demo HR account. On 2026-09-29, the external smoke command passed against this URL, covering health, static assets, authentication, exact employee lookup, salary reporting, and logout without modifying salary data.

The initial Blueprint hook did not run during the first free-tier deployment. A temporary recovery commit ran the existing safe production seed between migrations and startup against a newly recreated empty database. After the user confirmed the application and the automated external smoke test passed, the Blueprint returned to migration-only startup; the one-time hook remains for clean future environments. The free service may take 50 seconds or more to wake after inactivity, and the free database is subject to Render's retention and availability limits.
