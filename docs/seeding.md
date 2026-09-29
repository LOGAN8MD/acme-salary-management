# Synthetic assessment dataset

Task 4 added the explicit seed command. The completed application now uses that dataset for authentication, employee workflows, salary revisions, reporting, browser verification, and the reproducible demo.

## Run locally

Start PostgreSQL with `npm run db:local` if it is not already running. Copy `.env.example` to `.env` only if `.env` does not exist. Then run:

```sh
npm run db:migrate
npm run db:seed
```

The seed requires `DATABASE_URL` and `SEED_HR_PASSWORD` (12–128 characters). The example password is only for the synthetic local demo. For any hosted demo, set a private password through that environment's secret configuration before initial seeding.

The demo account email is **hr@acme.example.test**. Its initial password is the configured `SEED_HR_PASSWORD`. Use these credentials on the Task 5 login screen. The command prints record counts, status, and email, never the password or hash.

## Dataset

| Records / dimensions   | Values                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Employees              | Exactly 10,000; ACME-000001 through ACME-010000                                                          |
| Current salaries       | Exactly one per employee                                                                                 |
| Salary history         | 25,000 entries: 10,000 INITIAL and 15,000 REVISION                                                       |
| HR accounts            | One demo HR account; no sessions created                                                                 |
| Countries / currencies | IN/INR, US/USD, GB/GBP, DE/EUR, JP/JPY; 2,000 employees per pair                                         |
| Departments            | Engineering, Finance, People, Sales, Operations, Marketing                                               |
| Job levels             | L1–L5                                                                                                    |
| History length         | 1–4 entries per employee; 2,500 employees in each group                                                  |
| Fixed timeline         | Initial salary on 2024-01-01; optional revisions on 2024-07-01, 2025-01-01, 2025-07-01; all midnight UTC |

Amounts are synthetic examples, not market salary benchmarks. Names are generated combinations and email addresses use reserved `.test` domains. Country and currency remain separate database fields; the chosen seed mapping is not an application rule.

Generation uses fixed pseudo-random input, deterministic UUID namespaces and dates, and integer minor-unit arithmetic with BigInt. Every revision references its previous amount, retains currency, increments the version, and advances the timestamp. Each current salary exactly matches its latest history entry. JPY uses whole units; other seeded currencies use two decimal places.

The employee/salary/history dataset is reproducible. Password hashes intentionally differ across fresh databases because they use random salts. The demo password is stored using Node's scrypt with N=131072, r=8, p=1, a 16-byte random salt, and a 64-byte key. Format: `scrypt$N$r$p$saltHex$keyHex`. This follows the [OWASP scrypt guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) and [Node crypto API](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html). Task 5 verifies this format during login.

## Safe reruns

- **Empty database:** create the account and entire dataset in one transaction using batches of 500 rows. A failure rolls everything back.
- **Complete matching dataset:** verify employee identities, expected account, and salary/history coherence, then return `unchanged`. Preserve edited salary values, new coherent revisions, profiles, password hashes, and existing sessions. A different password argument does not reset the stored password.
- **Partial, unrelated, or inconsistent data:** stop with an error and change nothing. There is no reset, truncate, or automatic repair mode.
- Concurrent seed commands serialize with a transaction-scoped advisory lock. Seeds are explicit commands and do not run at server/database startup.

To create a fresh dataset later, point at a new empty database and apply migrations first. Do not delete an existing review database merely to rerun the seed. Task 9 salary revisions preserve the same currency/version/history invariants after seeding.

## Verification

```sh
npm run check
npm run test:db
```

Unit tests check reproducibility, IDs, dimensions, decimal formatting, timeline/version/amount continuity, and password derivation. Database tests verify full-size import, concurrent duplicate prevention, preservation of a later salary revision and password, rejection of incomplete/unrelated data, and rollback after an injected insert failure. The latter only runs inside the disposable test database.
