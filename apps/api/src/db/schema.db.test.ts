import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from './client.js';

if (
  !process.env.DATABASE_URL ||
  process.env.ACME_DISPOSABLE_DATABASE !== process.env.DATABASE_URL
) {
  throw new Error(
    'Run database tests through npm run test:db against a disposable cluster.',
  );
}
const db = createDatabaseClient();
const employeeId = '00000000-0000-4000-8000-000000000010';
const userId = '00000000-0000-4000-8000-000000000001';
const baseline = {
  employeeId,
  annualBaseAmount: '1234567890123456.78',
  currencyCode: 'INR',
  version: 1,
};
beforeEach(async () => {
  // This suite is only launched against the disposable cluster created by test:db.
  await db.salaryChange.deleteMany();
  await db.currentSalary.deleteMany();
  await db.session.deleteMany();
  await db.employee.deleteMany();
  await db.hrUser.deleteMany();
  await db.hrUser.create({
    data: { id: userId, email: 'hr@example.test', passwordHash: 'test-hash' },
  });
  await db.employee.create({
    data: {
      id: employeeId,
      employeeCode: 'ACME-000010',
      name: 'Test Employee',
      email: 'employee@example.test',
      countryCode: 'IN',
      department: 'Engineering',
      jobLevel: 'L2',
    },
  });
});
afterAll(() => db.$disconnect());

describe('PostgreSQL schema and constraints', () => {
  it('preserves exact decimal amounts beyond JavaScript safe integer precision', async () => {
    await db.currentSalary.create({ data: baseline });
    const result = await db.currentSalary.findUniqueOrThrow({
      where: { employeeId },
    });
    expect(result.annualBaseAmount.toFixed(2)).toBe('1234567890123456.78');
  });
  it.each(['0', '-1', 'NaN'])('rejects invalid salary %s', async (amount) => {
    await expect(
      db.currentSalary.create({
        data: { ...baseline, annualBaseAmount: amount },
      }),
    ).rejects.toThrow();
  });
  it('rejects values beyond the database amount range', async () => {
    await expect(
      db.currentSalary.create({
        data: { ...baseline, annualBaseAmount: '10000000000000000.00' },
      }),
    ).rejects.toThrow();
  });
  it('rejects unsupported currency, fractional JPY, and nonpositive versions', async () => {
    await expect(
      db.currentSalary.create({ data: { ...baseline, currencyCode: 'XYZ' } }),
    ).rejects.toThrow();
    await expect(
      db.currentSalary.create({
        data: { ...baseline, currencyCode: 'JPY', annualBaseAmount: '1.50' },
      }),
    ).rejects.toThrow();
    await expect(
      db.currentSalary.create({ data: { ...baseline, version: 0 } }),
    ).rejects.toThrow();
  });
  it('enforces employee uniqueness and salary foreign keys', async () => {
    await expect(
      db.employee.create({
        data: {
          employeeCode: 'ACME-000010',
          name: 'Duplicate',
          email: 'other@example.test',
          countryCode: 'US',
          department: 'Finance',
          jobLevel: 'L1',
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.currentSalary.create({
        data: {
          ...baseline,
          employeeId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    ).rejects.toThrow();
  });
  it('supports anonymous sessions while enforcing expiry and normalized user emails', async () => {
    await db.session.create({
      data: {
        tokenHash: 'token-hash',
        csrfTokenHash: 'csrf-hash',
        expiresAt: new Date('2099-01-01'),
      },
    });
    await expect(
      db.session.create({
        data: {
          tokenHash: 'other',
          csrfTokenHash: 'csrf',
          createdAt: new Date('2026-01-02'),
          expiresAt: new Date('2026-01-01'),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.hrUser.create({
        data: { email: ' HR@EXAMPLE.TEST ', passwordHash: 'hash' },
      }),
    ).rejects.toThrow();
  });
  it('enforces initial/revision field combinations and unique history versions', async () => {
    const initial = {
      employeeId,
      kind: 'INITIAL' as const,
      newAmount: '100.00',
      currencyCode: 'INR',
      reason: 'Seed initialization',
      salaryVersion: 1,
    };
    await db.salaryChange.create({ data: initial });
    await expect(db.salaryChange.create({ data: initial })).rejects.toThrow();
    await expect(
      db.salaryChange.create({ data: { ...initial, salaryVersion: 2 } }),
    ).rejects.toThrow();
    await expect(
      db.salaryChange.create({
        data: {
          ...initial,
          kind: 'REVISION',
          salaryVersion: 2,
          previousAmount: '90.00',
        },
      }),
    ).rejects.toThrow();
    await db.salaryChange.create({
      data: {
        ...initial,
        kind: 'REVISION',
        salaryVersion: 2,
        previousAmount: '90.00',
        changedByUserId: userId,
      },
    });
    await expect(db.hrUser.delete({ where: { id: userId } })).rejects.toThrow();
  });
  it('rolls back the salary write if its history insertion violates a constraint', async () => {
    await db.currentSalary.create({
      data: { ...baseline, annualBaseAmount: '100.00' },
    });
    await expect(
      db.$transaction(async (tx) => {
        await tx.currentSalary.update({
          where: { employeeId },
          data: { annualBaseAmount: '200.00', version: 2 },
        });
        await tx.salaryChange.create({
          data: {
            employeeId,
            kind: 'REVISION',
            previousAmount: '100',
            newAmount: '200',
            currencyCode: 'INR',
            reason: 'Invalid actor',
            salaryVersion: 2,
          },
        });
      }),
    ).rejects.toThrow();
    const result = await db.currentSalary.findUniqueOrThrow({
      where: { employeeId },
    });
    expect(result.annualBaseAmount.toFixed(2)).toBe('100.00');
    expect(result.version).toBe(1);
    expect(await db.salaryChange.count()).toBe(0);
  });
  it('restricts deletion of an employee referenced by salary data', async () => {
    await db.currentSalary.create({ data: baseline });
    await expect(
      db.employee.delete({ where: { id: employeeId } }),
    ).rejects.toThrow();
  });
});
