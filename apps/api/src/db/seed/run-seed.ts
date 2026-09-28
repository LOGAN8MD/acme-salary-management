import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  generateSeedDataset,
  SEED_EMPLOYEE_COUNT,
  SEED_HR_EMAIL,
  SEED_HR_ID,
  SEED_DATE,
} from './dataset.js';
import { hashSeedPassword } from './password.js';

/** Check whole-dataset coherence, while allowing legitimate later salary revisions. */
async function assertCoherent(tx: Prisma.TransactionClient) {
  const [result] = await tx.$queryRaw<{ invalid: boolean }[]>`
    WITH history AS (
      SELECT *, row_number() OVER w AS position,
        lag(new_amount) OVER w AS prior_amount,
        lag(recorded_at) OVER w AS prior_time,
        first_value(currency_code) OVER w AS initial_currency
      FROM salary_changes
      WINDOW w AS (PARTITION BY employee_id ORDER BY salary_version)
    ), latest AS (
      SELECT DISTINCT ON (employee_id) * FROM salary_changes
      ORDER BY employee_id, salary_version DESC
    )
    SELECT EXISTS (
      SELECT 1 FROM history WHERE salary_version <> position
        OR (kind = 'REVISION' AND previous_amount IS DISTINCT FROM prior_amount)
        OR currency_code <> initial_currency OR recorded_at < prior_time
      UNION ALL
      SELECT 1 FROM employees e
      LEFT JOIN current_salaries s ON s.employee_id = e.id
      LEFT JOIN latest h ON h.employee_id = e.id
      WHERE s.employee_id IS NULL OR h.id IS NULL
        OR s.annual_base_amount <> h.new_amount OR s.version <> h.salary_version
        OR s.currency_code <> h.currency_code OR s.updated_at <> h.recorded_at
    ) AS invalid
  `;
  if (!result || result.invalid) {
    throw new Error(
      'Existing seed data is incomplete or inconsistent. No records were changed.',
    );
  }
}

/** An explicit bootstrap, never a reset: empty -> insert atomically; complete -> no-op. */
export async function seedDatabase(db: PrismaClient, password: string) {
  // Validate configuration before entering a transaction; do not echo the password.
  if (password.length < 12 || password.length > 128) {
    throw new Error(
      'SEED_HR_PASSWORD must contain between 12 and 128 characters.',
    );
  }
  const dataset = generateSeedDataset();
  return db.$transaction(
    async (tx) => {
      // Serialize concurrent seed invocations without resetting any existing records.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260928, 4)`;
      const existing = await tx.employee.findMany({
        select: { id: true, employeeCode: true },
      });
      if (existing.length > 0) {
        const expected = new Map(
          dataset.employees.map((employee) => [
            employee.id,
            employee.employeeCode,
          ]),
        );
        const user = await tx.hrUser.findUnique({ where: { id: SEED_HR_ID } });
        if (
          existing.length !== SEED_EMPLOYEE_COUNT ||
          existing.some(
            (employee) => expected.get(employee.id) !== employee.employeeCode,
          ) ||
          user?.email !== SEED_HR_EMAIL
        ) {
          throw new Error(
            'Database is not an empty or complete ACME seed dataset. No records were changed.',
          );
        }
        await assertCoherent(tx);
        return {
          status: 'unchanged' as const,
          employees: existing.length,
          salaryChanges: await tx.salaryChange.count(),
          hrEmail: SEED_HR_EMAIL,
        };
      }
      if (
        (await tx.hrUser.count()) ||
        (await tx.session.count()) ||
        (await tx.currentSalary.count()) ||
        (await tx.salaryChange.count())
      ) {
        throw new Error(
          'Database contains existing records. Seed requires an empty database; no records were changed.',
        );
      }
      await tx.hrUser.create({
        data: {
          id: SEED_HR_ID,
          email: SEED_HR_EMAIL,
          passwordHash: await hashSeedPassword(password),
          createdAt: SEED_DATE,
        },
      });
      const batchSize = 500;
      for (
        let offset = 0;
        offset < dataset.employees.length;
        offset += batchSize
      ) {
        await tx.employee.createMany({
          data: dataset.employees.slice(offset, offset + batchSize),
        });
        await tx.currentSalary.createMany({
          data: dataset.salaries.slice(offset, offset + batchSize),
        });
      }
      for (
        let offset = 0;
        offset < dataset.changes.length;
        offset += batchSize
      ) {
        await tx.salaryChange.createMany({
          data: dataset.changes.slice(offset, offset + batchSize),
        });
      }
      await assertCoherent(tx);
      return {
        status: 'created' as const,
        employees: SEED_EMPLOYEE_COUNT,
        salaryChanges: dataset.changes.length,
        hrEmail: SEED_HR_EMAIL,
      };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
}
