import type {
  EmployeeDirectoryQuery,
  SalaryHistoryQuery,
} from '@acme/contracts';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

const salarySelect = {
  annualBaseAmount: true,
  currencyCode: true,
  version: true,
  updatedAt: true,
} as const;
const employeeSelect = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  countryCode: true,
  department: true,
  jobLevel: true,
  salary: { select: salarySelect },
} as const;

function serializeEmployee(
  employee: Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>,
) {
  if (!employee.salary)
    throw new Error(`Employee ${employee.id} has no current salary.`);
  return {
    ...employee,
    salary: {
      ...employee.salary,
      annualBaseAmount: employee.salary.annualBaseAmount.toFixed(2),
      updatedAt: employee.salary.updatedAt.toISOString(),
    },
  };
}

export function createEmployeeService(db: PrismaClient) {
  return {
    async detail(employeeId: string) {
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: employeeSelect,
      });
      return employee ? { data: serializeEmployee(employee) } : null;
    },

    async salaryHistory(employeeId: string, query: SalaryHistoryQuery) {
      return db.$transaction(
        async (transaction) => {
          const employee = await transaction.employee.findUnique({
            where: { id: employeeId },
            select: { id: true },
          });
          if (!employee) return null;
          const where = { employeeId };
          const [totalItems, changes] = await Promise.all([
            transaction.salaryChange.count({ where }),
            transaction.salaryChange.findMany({
              where,
              orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
              select: {
                id: true,
                kind: true,
                previousAmount: true,
                newAmount: true,
                currencyCode: true,
                reason: true,
                salaryVersion: true,
                recordedAt: true,
                changedBy: { select: { id: true, email: true } },
              },
            }),
          ]);
          return {
            data: changes.map((change) => ({
              ...change,
              previousAmount: change.previousAmount?.toFixed(2) ?? null,
              newAmount: change.newAmount.toFixed(2),
              recordedAt: change.recordedAt.toISOString(),
            })),
            pagination: {
              page: query.page,
              pageSize: query.pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / query.pageSize),
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },

    async list(query: EmployeeDirectoryQuery) {
      const where: Prisma.EmployeeWhereInput = {
        salary: query.currencyCode
          ? { is: { currencyCode: query.currencyCode } }
          : { isNot: null },
        ...(query.countryCode && { countryCode: query.countryCode }),
        ...(query.department && { department: query.department }),
        ...(query.jobLevel && { jobLevel: query.jobLevel }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            {
              employeeCode: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          ],
        }),
      };
      const primary: Prisma.EmployeeOrderByWithRelationInput =
        query.sortBy === 'annualBaseAmount'
          ? { salary: { annualBaseAmount: query.sortOrder } }
          : { [query.sortBy]: query.sortOrder };
      return db.$transaction(
        async (transaction) => {
          const [totalItems, employees] = await Promise.all([
            transaction.employee.count({ where }),
            transaction.employee.findMany({
              where,
              select: employeeSelect,
              orderBy: [primary, { id: 'asc' }],
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
            }),
          ]);
          return {
            data: employees.map(serializeEmployee),
            pagination: {
              page: query.page,
              pageSize: query.pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / query.pageSize),
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },

    async filterOptions() {
      const [countries, departments, levels, currencies] = await Promise.all([
        db.employee.findMany({
          distinct: ['countryCode'],
          orderBy: { countryCode: 'asc' },
          select: { countryCode: true },
        }),
        db.employee.findMany({
          distinct: ['department'],
          orderBy: { department: 'asc' },
          select: { department: true },
        }),
        db.employee.findMany({
          distinct: ['jobLevel'],
          orderBy: { jobLevel: 'asc' },
          select: { jobLevel: true },
        }),
        db.currentSalary.findMany({
          distinct: ['currencyCode'],
          orderBy: { currencyCode: 'asc' },
          select: { currencyCode: true },
        }),
      ]);
      return {
        data: {
          countryCodes: countries.map(({ countryCode }) => countryCode),
          departments: departments.map(({ department }) => department),
          jobLevels: levels.map(({ jobLevel }) => jobLevel),
          currencyCodes: currencies.map(({ currencyCode }) => currencyCode),
        },
      };
    },
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
