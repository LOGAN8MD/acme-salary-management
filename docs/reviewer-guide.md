# Reviewer guide

ACME Salary Management is a focused HR application for maintaining annual base salary and answering descriptive compensation questions across 10,000 synthetic employees. The implementation is a TypeScript modular monolith: React/Vite, Express, Prisma, and PostgreSQL.

## Product walkthrough

1. Sign in as the single HR-manager role.
2. Review currency-isolated totals, average, median, and grouped salary summaries on the dashboard.
3. Search for an employee by name or code and combine country, department, level, and currency filters.
4. Open an employee to review their profile, current salary/version, and newest-first audit history.
5. Submit an immediate salary revision with a mandatory reason. The server rejects stale or unchanged edits and atomically updates current salary plus history.
6. Return to the dashboard to see invalidated report data, then sign out.

The hosted password is supplied privately with the submission. Local reviewers use `SEED_HR_PASSWORD` from their uncommitted `.env`; the example value is only for local synthetic data.

## Start locally

Use Node.js 24 and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run db:local
```

Keep that terminal open. In a second terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:5173`. The local account email is `hr@acme.example.test`; its password is the configured `SEED_HR_PASSWORD`.

## Verification

```sh
npm run check
npm run test:db
npm run test:e2e
npm run test:production
```

The database, browser, and production checks create isolated PostgreSQL clusters and do not alter the local demo database. See [quality verification](quality-verification.md) for coverage and measured performance, and [production deployment](deployment.md) for release configuration.

## Decisions worth reviewing

- Salary amounts use PostgreSQL `NUMERIC(18,2)` and plain decimal strings at API boundaries.
- Monetary reporting always selects one currency; no exchange rates or mixed-currency totals are implied.
- A conditional salary version update and audit insert share one transaction.
- Session tokens and CSRF tokens are stored only as hashes; mutations also require the exact configured origin.
- Ten thousand employees are served through indexed, paginated database queries; a distributed architecture would add cost without solving a current need.
- Migrations and the explicit safe seed remain separate from application startup.

The concise product scope and exclusions are in [requirements](requirements.md). Architectural reasoning, API contracts, actual AI usage, and the append-only implementation history are in [architecture](architecture.md), [API contracts](api-contracts.md), [AI workflow](ai-workflow.md), and [project memory](../PROJECT_MEMORY.md).
