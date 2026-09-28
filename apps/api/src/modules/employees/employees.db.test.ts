import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createDatabaseClient } from '../../db/client.js';
import { tokenHash } from '../auth/service.js';

if (
  !process.env.DATABASE_URL ||
  process.env.ACME_DISPOSABLE_DATABASE !== process.env.DATABASE_URL
)
  throw new Error('Use npm run test:db.');
const db = createDatabaseClient();
const rawSession = 'a'.repeat(64);
const rawCsrf = 'b'.repeat(64);
const firstEmployeeId = '00000000-0000-4000-8000-000000000001';
let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  await db.salaryChange.deleteMany();
  await db.currentSalary.deleteMany();
  await db.session.deleteMany();
  await db.employee.deleteMany();
  await db.hrUser.deleteMany();
  const user = await db.hrUser.create({
    data: { email: 'directory@example.test', passwordHash: 'unused' },
  });
  await db.session.create({
    data: {
      tokenHash: tokenHash(rawSession),
      csrfTokenHash: tokenHash(rawCsrf),
      userId: user.id,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    },
  });
  const employees = [
    [
      '00000000-0000-4000-8000-000000000001',
      'ACME-000001',
      'Asha Rao',
      'IN',
      'Engineering',
      'L2',
      'INR',
      '1800000',
    ],
    [
      '00000000-0000-4000-8000-000000000002',
      'ACME-000002',
      'Alex Miller',
      'US',
      'Finance',
      'L3',
      'USD',
      '95000',
    ],
    [
      '00000000-0000-4000-8000-000000000003',
      'ACME-000003',
      'Asha Patel',
      'IN',
      'Engineering',
      'L1',
      'INR',
      '900000',
    ],
  ] as const;
  for (const [
    id,
    employeeCode,
    name,
    countryCode,
    department,
    jobLevel,
    currencyCode,
    annualBaseAmount,
  ] of employees)
    await db.employee.create({
      data: {
        id,
        employeeCode,
        name,
        email: `${employeeCode.toLowerCase()}@example.test`,
        countryCode,
        department,
        jobLevel,
        salary: {
          create: { annualBaseAmount, currencyCode, version: 1 },
        },
      },
    });
  await db.currentSalary.update({
    where: { employeeId: firstEmployeeId },
    data: { annualBaseAmount: '1800000', version: 2 },
  });
  await db.salaryChange.createMany({
    data: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        employeeId: firstEmployeeId,
        kind: 'INITIAL',
        previousAmount: null,
        newAmount: '1700000',
        currencyCode: 'INR',
        reason: 'Seed initialization',
        changedByUserId: null,
        salaryVersion: 1,
        recordedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        employeeId: firstEmployeeId,
        kind: 'REVISION',
        previousAmount: '1700000',
        newAmount: '1800000',
        currencyCode: 'INR',
        reason: 'Annual salary review',
        changedByUserId: user.id,
        salaryVersion: 2,
        recordedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  });
  app = createApp({
    db,
    auth: { origin: 'http://127.0.0.1:5173', secureCookies: false },
    now: () => new Date('2026-09-28T00:00:00.000Z'),
  });
});
afterAll(() => db.$disconnect());
const authenticated = () =>
  request(app)
    .get('/api/v1/employees')
    .set('Cookie', `acme-session=${rawSession}`);
const updateSalary = (body: object, employeeId = firstEmployeeId) =>
  request(app)
    .patch(`/api/v1/employees/${employeeId}/salary`)
    .set('Cookie', `acme-session=${rawSession}`)
    .set('Origin', 'http://127.0.0.1:5173')
    .set('X-CSRF-Token', rawCsrf)
    .send(body);

describe('employee directory', () => {
  it('requires authentication and validates query values', async () => {
    expect((await request(app).get('/api/v1/employees')).status).toBe(401);
    const response = await authenticated().query({ page: 0 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('searches, filters, sorts, and paginates current salaries', async () => {
    const response = await authenticated().query({
      search: 'asha',
      countryCode: 'IN',
      currencyCode: 'INR',
      sortBy: 'annualBaseAmount',
      sortOrder: 'desc',
      pageSize: 1,
      page: 2,
    });
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      employeeCode: 'ACME-000003',
      salary: { annualBaseAmount: '900000.00', currencyCode: 'INR' },
    });
  });

  it('returns sorted complete filter options', async () => {
    const response = await request(app)
      .get('/api/v1/employees/filter-options')
      .set('Cookie', `acme-session=${rawSession}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      countryCodes: ['IN', 'US'],
      departments: ['Engineering', 'Finance'],
      jobLevels: ['L1', 'L2', 'L3'],
      currencyCodes: ['INR', 'USD'],
    });
  });

  it('returns employee detail and newest-first paginated salary history', async () => {
    const detail = await request(app)
      .get(`/api/v1/employees/${firstEmployeeId}`)
      .set('Cookie', `acme-session=${rawSession}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      employeeCode: 'ACME-000001',
      salary: { annualBaseAmount: '1800000.00', version: 2 },
    });
    const history = await request(app)
      .get(`/api/v1/employees/${firstEmployeeId}/salary-history`)
      .query({ pageSize: 1 })
      .set('Cookie', `acme-session=${rawSession}`);
    expect(history.status).toBe(200);
    expect(history.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(history.body.data[0]).toMatchObject({
      kind: 'REVISION',
      previousAmount: '1700000.00',
      newAmount: '1800000.00',
      reason: 'Annual salary review',
      changedBy: { email: 'directory@example.test' },
      salaryVersion: 2,
    });
  });

  it('distinguishes invalid and missing employee identifiers', async () => {
    const cookie = `acme-session=${rawSession}`;
    expect(
      (
        await request(app)
          .get('/api/v1/employees/not-a-uuid')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);
    const missing = '00000000-0000-4000-8000-000000000099';
    const detail = await request(app)
      .get(`/api/v1/employees/${missing}`)
      .set('Cookie', cookie);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    expect(
      (
        await request(app)
          .get(`/api/v1/employees/${missing}/salary-history`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(404);
  });

  it('atomically updates the current salary and appends an attributed revision', async () => {
    const response = await updateSalary({
      annualBaseAmount: '1900000.5',
      reason: '  Promotion review  ',
      expectedVersion: 2,
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      salary: { annualBaseAmount: '1900000.50', version: 3 },
      change: {
        previousAmount: '1800000.00',
        newAmount: '1900000.50',
        reason: 'Promotion review',
        salaryVersion: 3,
        changedBy: { email: 'directory@example.test' },
      },
    });
    const stored = await db.currentSalary.findUniqueOrThrow({
      where: { employeeId: firstEmployeeId },
    });
    expect(stored.annualBaseAmount.toFixed(2)).toBe('1900000.50');
    expect(stored.version).toBe(3);
    expect(
      await db.salaryChange.count({ where: { employeeId: firstEmployeeId } }),
    ).toBe(3);
  });

  it('checks stale versions before unchanged values and enforces currency precision', async () => {
    const stale = await updateSalary({
      annualBaseAmount: '1800000',
      reason: 'Stale review',
      expectedVersion: 1,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('SALARY_VERSION_CONFLICT');
    const unchanged = await updateSalary({
      annualBaseAmount: '1800000',
      reason: 'No actual change',
      expectedVersion: 2,
    });
    expect(unchanged.status).toBe(400);
    expect(unchanged.body.error.code).toBe('SALARY_UNCHANGED');
    const jpyEmployeeId = '00000000-0000-4000-8000-000000000002';
    await db.currentSalary.update({
      where: { employeeId: jpyEmployeeId },
      data: { currencyCode: 'JPY', annualBaseAmount: '95000' },
    });
    const fractionalJpy = await updateSalary(
      {
        annualBaseAmount: '96000.50',
        reason: 'Currency precision test',
        expectedVersion: 1,
      },
      jpyEmployeeId,
    );
    expect(fractionalJpy.status).toBe(400);
    expect(fractionalJpy.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows only one concurrent writer for an expected version', async () => {
    const responses = await Promise.all([
      updateSalary({
        annualBaseAmount: '1900000',
        reason: 'First concurrent review',
        expectedVersion: 2,
      }),
      updateSalary({
        annualBaseAmount: '1950000',
        reason: 'Second concurrent review',
        expectedVersion: 2,
      }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
      await db.salaryChange.count({
        where: { employeeId: firstEmployeeId, salaryVersion: 3 },
      }),
    ).toBe(1);
  });

  it('rolls back the current salary when history insertion fails', async () => {
    await db.$executeRawUnsafe(`CREATE FUNCTION reject_salary_revision() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reason = 'Reject history' THEN RAISE EXCEPTION 'Injected history failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(
      'CREATE TRIGGER reject_salary_revision BEFORE INSERT ON salary_changes FOR EACH ROW EXECUTE FUNCTION reject_salary_revision()',
    );
    try {
      const response = await updateSalary({
        annualBaseAmount: '1900000',
        reason: 'Reject history',
        expectedVersion: 2,
      });
      expect(response.status).toBe(500);
      const salary = await db.currentSalary.findUniqueOrThrow({
        where: { employeeId: firstEmployeeId },
      });
      expect(salary.annualBaseAmount.toFixed(2)).toBe('1800000.00');
      expect(salary.version).toBe(2);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER reject_salary_revision ON salary_changes',
      );
      await db.$executeRawUnsafe('DROP FUNCTION reject_salary_revision()');
    }
  });
});
