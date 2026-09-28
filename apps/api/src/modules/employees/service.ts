import type {
  EmployeeDirectoryQuery,
  SalaryHistoryQuery,
  SalaryUpdateInput,
} from '@acme/contracts';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../middleware/errors.js';

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

function serializeSalaryChange<
  Change extends {
    previousAmount: Prisma.Decimal | null;
    newAmount: Prisma.Decimal;
    recordedAt: Date;
  },
>(change: Change) {
  return {
    ...change,
    previousAmount: change.previousAmount?.toFixed(2) ?? null,
    newAmount: change.newAmount.toFixed(2),
    recordedAt: change.recordedAt.toISOString(),
  };
}

export function createEmployeeService(
  db: PrismaClient,
  now = () => new Date(),
) {
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
            data: changes.map(serializeSalaryChange),
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

    async updateSalary(
      employeeId: string,
      actorId: string,
      input: SalaryUpdateInput,
    ) {
      return db.$transaction(async (transaction) => {
        const employee = await transaction.employee.findUnique({
          where: { id: employeeId },
          select: { salary: true },
        });
        if (!employee)
          throw new HttpError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
        if (!employee.salary)
          throw new Error(`Employee ${employeeId} has no current salary.`);
        const current = employee.salary;
        if (current.version !== input.expectedVersion)
          throw new HttpError(
            409,
            'SALARY_VERSION_CONFLICT',
            'The salary changed since this page was loaded. Review the latest value and try again.',
          );
        if (
          current.currencyCode === 'JPY' &&
          input.annualBaseAmount.includes('.')
        )
          throw new HttpError(
            400,
            'VALIDATION_ERROR',
            'JPY salaries must use whole amounts.',
          );
        const nextAmount = new Prisma.Decimal(input.annualBaseAmount);
        if (nextAmount.equals(current.annualBaseAmount))
          throw new HttpError(
            400,
            'SALARY_UNCHANGED',
            'Enter an amount different from the current salary.',
          );
        const recordedAt = now();
        const updated = await transaction.currentSalary.updateMany({
          where: { employeeId, version: input.expectedVersion },
          data: {
            annualBaseAmount: nextAmount,
            version: { increment: 1 },
            updatedAt: recordedAt,
          },
        });
        if (updated.count !== 1)
          throw new HttpError(
            409,
            'SALARY_VERSION_CONFLICT',
            'The salary changed since this page was loaded. Review the latest value and try again.',
          );
        const salary = await transaction.currentSalary.findUniqueOrThrow({
          where: { employeeId },
          select: salarySelect,
        });
        const change = await transaction.salaryChange.create({
          data: {
            employeeId,
            kind: 'REVISION',
            previousAmount: current.annualBaseAmount,
            newAmount: nextAmount,
            currencyCode: current.currencyCode,
            reason: input.reason,
            changedByUserId: actorId,
            salaryVersion: salary.version,
            recordedAt,
          },
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
        });
        return {
          data: {
            salary: {
              ...salary,
              annualBaseAmount: salary.annualBaseAmount.toFixed(2),
              updatedAt: salary.updatedAt.toISOString(),
            },
            change: serializeSalaryChange(change),
          },
        };
      });
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
