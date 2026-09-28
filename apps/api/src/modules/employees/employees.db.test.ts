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
      csrfTokenHash: tokenHash('b'.repeat(64)),
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
});
