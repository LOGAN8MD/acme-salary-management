import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../client.js';
import { seedDatabase } from './run-seed.js';
import { SEED_HR_ID } from './dataset.js';

if (
  !process.env.DATABASE_URL ||
  process.env.ACME_DISPOSABLE_DATABASE !== process.env.DATABASE_URL
) {
  throw new Error('Run through npm run test:db against a disposable cluster.');
}
const db = createDatabaseClient();
const password = 'SeedIntegrationPassword2026!';
beforeEach(async () => {
  await db.salaryChange.deleteMany();
  await db.currentSalary.deleteMany();
  await db.session.deleteMany();
  await db.employee.deleteMany();
  await db.hrUser.deleteMany();
});
afterAll(() => db.$disconnect());

describe('seed transaction', () => {
  it('creates the complete dataset once under concurrent calls, then preserves salary edits and credentials', async () => {
    const results = await Promise.all([
      seedDatabase(db, password),
      seedDatabase(db, password),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'created',
      'unchanged',
    ]);
    expect(await db.employee.count()).toBe(10_000);
    expect(await db.currentSalary.count()).toBe(10_000);
    expect(await db.salaryChange.count()).toBe(25_000);
    expect(await db.hrUser.count()).toBe(1);
    expect(await db.session.count()).toBe(0);
    const user = await db.hrUser.findUniqueOrThrow({
      where: { id: SEED_HR_ID },
    });
    expect(user.passwordHash.startsWith('scrypt$131072$8$1$')).toBe(true);
    const current = await db.currentSalary.findFirstOrThrow({
      orderBy: { employeeId: 'asc' },
    });
    const now = new Date('2026-09-28T12:00:00.000Z');
    const updated = await db.$transaction(async (tx) => {
      const salary = await tx.currentSalary.update({
        where: { employeeId: current.employeeId },
        data: {
          annualBaseAmount: current.annualBaseAmount.add(100),
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      await tx.salaryChange.create({
        data: {
          employeeId: current.employeeId,
          kind: 'REVISION',
          previousAmount: current.annualBaseAmount,
          newAmount: salary.annualBaseAmount,
          currencyCode: current.currencyCode,
          reason: 'Preserve evaluator salary edit',
          changedByUserId: SEED_HR_ID,
          salaryVersion: salary.version,
          recordedAt: now,
        },
      });
      return salary;
    });
    expect((await seedDatabase(db, 'DifferentPassword2026!')).status).toBe(
      'unchanged',
    );
    expect(
      await db.currentSalary.findUniqueOrThrow({
        where: { employeeId: current.employeeId },
      }),
    ).toEqual(updated);
    expect(
      (await db.hrUser.findUniqueOrThrow({ where: { id: SEED_HR_ID } }))
        .passwordHash,
    ).toBe(user.passwordHash);
    expect(await db.salaryChange.count()).toBe(25_001);
    // An incomplete dataset must be diagnosed, never silently repaired/reset.
    await db.currentSalary.delete({
      where: { employeeId: current.employeeId },
    });
    await expect(seedDatabase(db, password)).rejects.toThrow(
      'incomplete or inconsistent',
    );
    expect(await db.currentSalary.count()).toBe(9_999);
    expect(await db.salaryChange.count()).toBe(25_001);
  }, 60_000);
  it('refuses unrelated existing data without creating or overwriting records', async () => {
    const user = await db.hrUser.create({
      data: { email: 'existing@example.test', passwordHash: 'unchanged-hash' },
    });
    await expect(seedDatabase(db, password)).rejects.toThrow(
      'existing records',
    );
    expect(await db.hrUser.findMany()).toEqual([user]);
    expect(await db.employee.count()).toBe(0);
  });
  it('rolls back the entire import if a later insert fails', async () => {
    // Failure injection is scoped to this temporary database and always removed.
    await db.$executeRawUnsafe(`CREATE FUNCTION reject_seed_row() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.employee_code = 'ACME-002001' THEN RAISE EXCEPTION 'Injected seed failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(
      'CREATE TRIGGER reject_seed_row BEFORE INSERT ON employees FOR EACH ROW EXECUTE FUNCTION reject_seed_row()',
    );
    try {
      await expect(seedDatabase(db, password)).rejects.toThrow();
      expect(await db.employee.count()).toBe(0);
      expect(await db.currentSalary.count()).toBe(0);
      expect(await db.salaryChange.count()).toBe(0);
      expect(await db.hrUser.count()).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER reject_seed_row ON employees');
      await db.$executeRawUnsafe('DROP FUNCTION reject_seed_row()');
    }
  });
});
