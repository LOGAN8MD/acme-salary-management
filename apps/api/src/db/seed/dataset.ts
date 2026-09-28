import type { Prisma } from '../../generated/prisma/client.js';

export const SEED_EMPLOYEE_COUNT = 10_000;
export const SEED_HR_ID = 'ac4e0000-0000-4000-8000-000000000001';
export const SEED_HR_EMAIL = 'hr@acme.example.test';
export const SEED_DATE = new Date('2024-01-01T00:00:00.000Z');
const HISTORY_DATES = [
  SEED_DATE,
  new Date('2024-07-01T00:00:00.000Z'),
  new Date('2025-01-01T00:00:00.000Z'),
  new Date('2025-07-01T00:00:00.000Z'),
];
const COUNTRIES = [
  { country: 'IN', currency: 'INR', base: 400_000n, decimals: 2 },
  { country: 'US', currency: 'USD', base: 40_000n, decimals: 2 },
  { country: 'GB', currency: 'GBP', base: 30_000n, decimals: 2 },
  { country: 'DE', currency: 'EUR', base: 35_000n, decimals: 2 },
  { country: 'JP', currency: 'JPY', base: 3_500_000n, decimals: 0 },
] as const;
const DEPARTMENTS = [
  'Engineering',
  'Finance',
  'People',
  'Sales',
  'Operations',
  'Marketing',
];
const FIRST_NAMES = [
  'Asha',
  'Alex',
  'Mina',
  'Sam',
  'Noor',
  'Kai',
  'Priya',
  'Robin',
  'Emi',
  'Luca',
  'Amara',
  'Leo',
];
const LAST_NAMES = [
  'Rao',
  'Miller',
  'Sato',
  'Khan',
  'Weber',
  'Patel',
  'Chen',
  'Taylor',
  'Silva',
  'Kim',
  'Okafor',
  'Martin',
];

function randomGenerator() {
  let state = 20260928;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}
function seedId(namespace: string, index: number) {
  return `${namespace}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}
function amountString(minor: bigint, decimals: number) {
  if (decimals === 0) return minor.toString();
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`;
}

/** Fixed pseudo-random seed, UUIDs, and dates; never uses wall clock or external data. */
export function generateSeedDataset() {
  const random = randomGenerator();
  const employees: Prisma.EmployeeCreateManyInput[] = [];
  const salaries: Prisma.CurrentSalaryCreateManyInput[] = [];
  const changes: Prisma.SalaryChangeCreateManyInput[] = [];
  for (let index = 0; index < SEED_EMPLOYEE_COUNT; index++) {
    const country = COUNTRIES[index % COUNTRIES.length]!;
    const level =
      (Math.floor(index / (COUNTRIES.length * DEPARTMENTS.length)) % 5) + 1;
    const employeeId = seedId('ac4e0001', index + 1);
    const employeeCode = `ACME-${String(index + 1).padStart(6, '0')}`;
    employees.push({
      id: employeeId,
      employeeCode,
      name: `${FIRST_NAMES[random() % FIRST_NAMES.length]} ${LAST_NAMES[random() % LAST_NAMES.length]}`,
      email: `${employeeCode.toLowerCase()}@employees.example.test`,
      countryCode: country.country,
      department:
        DEPARTMENTS[Math.floor(index / COUNTRIES.length) % DEPARTMENTS.length]!,
      jobLevel: `L${level}`,
      createdAt: SEED_DATE,
    });
    const scale = country.decimals === 0 ? 1n : 100n;
    let amount =
      (country.base *
        scale *
        BigInt(level + 1) *
        BigInt(8000 + (random() % 4001))) /
      20_000n;
    const revisionCount = index % 4;
    let previousAmount: string | null = null;
    for (let revision = 0; revision <= revisionCount; revision++) {
      if (revision > 0)
        amount += (amount * BigInt(300 + (random() % 901))) / 10_000n;
      const newAmount = amountString(amount, country.decimals);
      changes.push({
        id: seedId('ac4e0002', index * 4 + revision + 1),
        employeeId,
        kind: revision === 0 ? 'INITIAL' : 'REVISION',
        previousAmount,
        newAmount,
        currencyCode: country.currency,
        reason:
          revision === 0
            ? 'Seed initialization'
            : 'Synthetic annual compensation review',
        changedByUserId: revision === 0 ? null : SEED_HR_ID,
        salaryVersion: revision + 1,
        recordedAt: HISTORY_DATES[revision]!,
      });
      previousAmount = newAmount;
    }
    salaries.push({
      employeeId,
      annualBaseAmount: amountString(amount, country.decimals),
      currencyCode: country.currency,
      version: revisionCount + 1,
      updatedAt: HISTORY_DATES[revisionCount]!,
    });
  }
  return { employees, salaries, changes };
}
