# Quality verification

Task 11 adds a browser-level critical journey, a reproducible performance measurement, and continuous-integration configuration. Task 12 adds compiled production-mode and deployment smoke checks. These complement the focused unit, component, contract, and PostgreSQL integration suites; they do not replace them.

## Isolated test environment

Both Task 11 commands create a temporary PostgreSQL cluster on unused localhost ports, apply committed migrations, and seed exactly 10,000 employees and 25,000 salary events. They start the real Express API and Vite application on additional unused ports. Shutdown removes the temporary cluster even when a check fails, so neither command reads or changes the developer's local demo database.

Install Playwright's browser once after `npm ci`:

```sh
npx playwright install chromium
```

Run the critical browser journey:

```sh
npm run test:e2e
```

The Chromium test signs in, verifies the dashboard population, finds `ACME-000001`, opens the employee, performs a real salary revision, checks the new attributed history row, confirms that the cached report total refreshes, and signs out. It uses accessible roles and labels, checks initial keyboard focus, and verifies route-change heading focus. Failure traces, screenshots, and videos are written under ignored `.artifacts/` paths.

GitHub Actions runs `npm run check`, `npm run test:db`, `npm run test:production`, and `npm run test:e2e` on pull requests and pushes to `main`. The performance command remains an explicit measurement because shared CI runner results would be noisy and misleading.

## Production and hosted smoke checks

`npm run test:production` builds all workspaces, starts only the compiled Node service, and verifies the production SPA/API behavior against an isolated seeded database. It checks database readiness, security headers, immutable assets, browser-route fallback, login, exact employee lookup, an INR report, and logout. The smoke journey is deliberately read-only.

`npm run test:deployment` runs the same HTTP checks against `DEPLOYMENT_URL`; provide `DEPLOYMENT_SMOKE_PASSWORD` separately. See [production deployment](deployment.md) for configuration and current hosting status.

## Performance method and result

Run:

```sh
npm run test:performance
```

The script signs in through the real HTTP API and sends requests through the Vite proxy. Each case receives five warm-up requests, then 50 measured requests in ten batches of five concurrent requests. Responses are fully consumed. The cases are the first 25 directory records, one employee detail, and the INR department report. Database creation, migration, seeding, startup, login, and internet latency are excluded.

Measurement on 2026-09-29:

| Case      | p50     | p95      | Maximum  |
| --------- | ------- | -------- | -------- |
| Directory | 9.38 ms | 11.15 ms | 11.41 ms |
| Detail    | 2.28 ms | 4.25 ms  | 4.39 ms  |
| Report    | 8.41 ms | 9.78 ms  | 10.08 ms |

Environment: Apple M4 with 10 logical CPUs, macOS Darwin 24.6.0 arm64, Node.js 24.4.0, temporary local PostgreSQL, and localhost HTTP through the Vite proxy. All measured p95 values were below the provisional one-second target.

These numbers describe one local run, not hosted production capacity. They omit TLS, internet latency, managed-database network distance, cold starts, and sustained or adversarial load. The committed command makes the method repeatable so another reviewer can compare results on their own machine.
