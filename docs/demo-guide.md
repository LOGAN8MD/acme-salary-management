# Demo guide

## Reproducible video

Install Playwright's Chromium runtime once, then record the walkthrough:

```sh
npx playwright install chromium
npm run demo:record
```

The command creates an isolated PostgreSQL database, applies migrations, seeds 10,000 employees and 25,000 salary events, starts the real API and Vite application, and records a 1440×900 WebM video at:

```text
.artifacts/demo/acme-salary-management-demo.webm
```

The recording signs in, reviews the organization dashboard, searches for `ACME-000001`, opens salary history, records a salary revision with a reason, revisits refreshed reporting, and signs out. The temporary database is removed after recording. The password field stays masked, and the video contains synthetic data only.

The generated binary is intentionally ignored by Git. Upload it to the chosen video-sharing service and place the reviewable URL in the submission email.

## Suggested narration

1. **Purpose:** replace salary spreadsheets with a focused HR workflow for 10,000 employees.
2. **Dashboard:** explain why every monetary metric is isolated to one currency and why the all-currency population is labeled separately.
3. **Directory:** show server pagination, search, filters, stable sorting, and localized salary formatting.
4. **Employee:** show the current salary version and immutable, actor-attributed history.
5. **Revision:** explain exact-decimal validation, mandatory reason, stale-version protection, and the atomic salary/history transaction.
6. **Refresh:** show the changed record and refreshed salary report.
7. **Engineering evidence:** briefly point reviewers to requirements, architecture, tests, deployment guide, AI workflow, and incremental commits.

Aim for three to five minutes. Do not narrate or display the hosted password, database URL, provider settings, or session values.
