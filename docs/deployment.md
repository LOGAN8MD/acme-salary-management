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
| `HOST`                      | Usually `0.0.0.0` inside the container                              |
| `PORT`                      | Hosting-provider port; defaults to `3001`                           |
| `TRUST_PROXY_HOPS`          | Number of trusted reverse-proxy hops; the Render blueprint uses `1` |
| `SEED_HR_PASSWORD`          | Strong secret used only by the explicit production seed command     |
| `DEPLOYMENT_URL`            | Smoke-test target only                                              |
| `DEPLOYMENT_SMOKE_PASSWORD` | Smoke-test login only; may equal `SEED_HR_PASSWORD`                 |

Do not expose secrets through `VITE_` variables. Proxy trust is deliberately numeric and bounded; configure it to the known hosting topology rather than accepting arbitrary forwarded headers.

## Database release procedure

Every release runs `npm run db:migrate` before application startup. The application never creates schema or seed data during startup. For the first environment only, run:

```sh
npm run db:seed:production
```

The production seed imports compiled application code, requires `SEED_HR_PASSWORD`, and has the same safe rerun behavior as the local seed: it accepts the complete known dataset and refuses partial or unrelated data. Do not run it as a routine deploy step after initialization.

Back up the managed database and verify restoration according to the provider's retention plan before a schema release. Migrations are forward-only: if an application release must be rolled back, redeploy the prior image only when its code remains compatible with the migrated schema. Otherwise, issue a reviewed corrective migration; never edit an applied migration.

## Container

Build and run the image locally when Docker is available:

```sh
docker build -t acme-salary-management .
docker run --rm -p 3001:10000 \
  -e PORT=10000 \
  -e DATABASE_URL='postgresql://...' \
  -e APP_ORIGIN='https://your-service.example' \
  -e TRUST_PROXY_HOPS=1 \
  acme-salary-management
```

The multi-stage image builds the workspaces, prunes development dependencies, runs as the unprivileged Node user, and includes a readiness health check. The repository's CI builds this image on every pull request and push to `main`. Docker is not installed in the development environment used for Task 12, so the image build is delegated to CI rather than claimed as a local result.

## Render Blueprint

`render.yaml` defines one Docker web service and one private PostgreSQL database in Singapore. The free plan is selected so importing the blueprint does not silently choose a paid tier; review current capacity and availability limits before using it for a real organization.

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Render, create a Blueprint from the repository and review the proposed resources.
3. Supply `APP_ORIGIN` using the final Render service URL and a strong `SEED_HR_PASSWORD` when prompted.
4. Let the pre-deploy command apply migrations. The initial-deploy hook seeds the first environment once.
5. Confirm `/api/v1/health`, then run `npm run test:deployment` with the final URL and password.

The configuration follows Render's official [Blueprint specification](https://render.com/docs/blueprint-spec), [Docker deployment](https://render.com/docs/docker), [health-check](https://render.com/docs/health-checks), and [PostgreSQL connection](https://render.com/docs/postgresql-creating-connecting) guidance. Migration placement follows Render's [Prisma deployment guide](https://render.com/docs/deploy-prisma-orm).

## Current release status

The production build, single-origin server, isolated production smoke test, container definition, and Render blueprint are complete. A public service has not been created because this workspace has no Git remote, hosting account credentials, or confirmed public origin. Publishing the repository, creating the hosted resources, recording the public URL, and producing the demo/submission material remain Task 13 delivery work.
