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
const rawSession = 'c'.repeat(64);
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await db.salaryChange.deleteMany();
  await db.currentSalary.deleteMany();
  await db.session.deleteMany();
  await db.employee.deleteMany();
  await db.hrUser.deleteMany();
  const user = await db.hrUser.create({
    data: { email: 'reports@example.test', passwordHash: 'unused' },
  });
  await db.session.create({
    data: {
      tokenHash: tokenHash(rawSession),
      csrfTokenHash: tokenHash('d'.repeat(64)),
      userId: user.id,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    },
  });
  const employees = [
    ['IN', 'Engineering', 'L1', 'INR', '100'],
    ['IN', 'Engineering', 'L2', 'INR', '200'],
    ['IN', 'Engineering', 'L3', 'INR', '400'],
    ['IN', 'Finance', 'L1', 'INR', '10'],
    ['IN', 'Finance', 'L2', 'INR', '30'],
    ['IN', 'Engineering', 'L2', 'USD', '25'],
    ['JP', 'Engineering', 'L1', 'JPY', '1'],
    ['JP', 'Engineering', 'L2', 'JPY', '2'],
  ] as const;
  for (const [index, employee] of employees.entries()) {
    const [countryCode, department, jobLevel, currencyCode, amount] = employee;
    const sequence = String(index + 1).padStart(6, '0');
    await db.employee.create({
      data: {
        employeeCode: `REPORT-${sequence}`,
        name: `Report Employee ${sequence}`,
        email: `report-${sequence}@example.test`,
        countryCode,
        department,
        jobLevel,
        salary: { create: { annualBaseAmount: amount, currencyCode } },
      },
    });
  }
  app = createApp({
    db,
    auth: { origin: 'http://127.0.0.1:5173', secureCookies: false },
    now: () => new Date('2026-09-29T00:00:00.000Z'),
  });
});
afterAll(() => db.$disconnect());

const report = (query: Record<string, string>) =>
  request(app)
    .get('/api/v1/reports/salaries')
    .set('Cookie', `acme-session=${rawSession}`)
    .query(query);

describe('salary reports', () => {
  it('requires authentication and rejects unsupported report parameters', async () => {
    expect(
      (await request(app).get('/api/v1/reports/salaries?currencyCode=INR'))
        .status,
    ).toBe(401);
    expect((await report({ currencyCode: 'CAD' })).status).toBe(400);
    expect(
      (await report({ currencyCode: 'INR', page: '1' })).body.error.code,
    ).toBe('VALIDATION_ERROR');
  });

  it('isolates currency and returns exact odd and even medians', async () => {
    const response = await report({
      currencyCode: 'INR',
      countryCode: 'IN',
      groupBy: 'department',
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      currencyCode: 'INR',
      groupBy: 'department',
      filters: { countryCode: 'IN', department: null, jobLevel: null },
      matchingEmployeeCountAllCurrencies: 6,
      summary: {
        employeeCount: 5,
        totalAnnualBaseAmount: '740.00',
        averageAnnualBaseAmount: '148.00',
        medianAnnualBaseAmount: '100.00',
      },
      groups: [
        {
          key: 'Engineering',
          employeeCount: 3,
          totalAnnualBaseAmount: '700.00',
          averageAnnualBaseAmount: '233.33',
          medianAnnualBaseAmount: '200.00',
        },
        {
          key: 'Finance',
          employeeCount: 2,
          totalAnnualBaseAmount: '40.00',
          averageAnnualBaseAmount: '20.00',
          medianAnnualBaseAmount: '20.00',
        },
      ],
    });
  });

  it('rounds once at currency precision and represents empty results', async () => {
    const jpy = await report({ currencyCode: 'JPY' });
    expect(jpy.status, JSON.stringify(jpy.body)).toBe(200);
    expect(jpy.body.data.summary).toEqual({
      employeeCount: 2,
      totalAnnualBaseAmount: '3',
      averageAnnualBaseAmount: '2',
      medianAnnualBaseAmount: '2',
    });
    const empty = await report({
      currencyCode: 'GBP',
      department: 'Engineering',
    });
    expect(empty.body.data).toMatchObject({
      matchingEmployeeCountAllCurrencies: 6,
      summary: {
        employeeCount: 0,
        totalAnnualBaseAmount: '0.00',
        averageAnnualBaseAmount: null,
        medianAnnualBaseAmount: null,
      },
      groups: [],
    });
  });
});
