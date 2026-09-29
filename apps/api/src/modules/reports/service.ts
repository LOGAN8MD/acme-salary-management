import type { SalaryReportQuery } from '@acme/contracts';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

type AggregateRow = {
  employeeCount: number;
  totalAnnualBaseAmount: Prisma.Decimal;
  averageAnnualBaseAmount: Prisma.Decimal | null;
  medianAnnualBaseAmount: Prisma.Decimal | null;
};
type GroupRow = AggregateRow & { key: string };

const currencyFractionDigits: Record<
  SalaryReportQuery['currencyCode'],
  number
> = { INR: 2, USD: 2, GBP: 2, EUR: 2, JPY: 0 };

function organizationFilters(query: SalaryReportQuery) {
  return [
    query.countryCode
      ? Prisma.sql`e.country_code = ${query.countryCode}`
      : null,
    query.department ? Prisma.sql`e.department = ${query.department}` : null,
    query.jobLevel ? Prisma.sql`e.job_level = ${query.jobLevel}` : null,
  ].filter((condition): condition is Prisma.Sql => condition !== null);
}

function whereClause(query: SalaryReportQuery, includeCurrency: boolean) {
  const conditions = [
    Prisma.sql`TRUE`,
    ...organizationFilters(query),
    ...(includeCurrency
      ? [Prisma.sql`s.currency_code = ${query.currencyCode}`]
      : []),
  ];
  const combined =
    conditions.length === 1 ? conditions[0] : Prisma.join(conditions, ' AND ');
  return Prisma.sql`WHERE ${combined}`;
}

function groupColumn(groupBy: SalaryReportQuery['groupBy']) {
  if (groupBy === 'countryCode') return Prisma.raw('e.country_code');
  if (groupBy === 'jobLevel') return Prisma.raw('e.job_level');
  return Prisma.raw('e.department');
}

function formatAmount(
  amount: Prisma.Decimal,
  currency: SalaryReportQuery['currencyCode'],
) {
  return amount
    .toDecimalPlaces(
      currencyFractionDigits[currency],
      Prisma.Decimal.ROUND_HALF_UP,
    )
    .toFixed(currencyFractionDigits[currency]);
}

function serializeStatistics(
  row: AggregateRow,
  currency: SalaryReportQuery['currencyCode'],
) {
  return {
    employeeCount: row.employeeCount,
    totalAnnualBaseAmount: formatAmount(row.totalAnnualBaseAmount, currency),
    averageAnnualBaseAmount: row.averageAnnualBaseAmount
      ? formatAmount(row.averageAnnualBaseAmount, currency)
      : null,
    medianAnnualBaseAmount: row.medianAnnualBaseAmount
      ? formatAmount(row.medianAnnualBaseAmount, currency)
      : null,
  };
}

export function createReportService(db: PrismaClient) {
  return {
    async salaries(query: SalaryReportQuery) {
      return db.$transaction(
        async (transaction) => {
          const organizationWhere = whereClause(query, false);
          const selectedCurrencyWhere = whereClause(query, true);
          const selectedGroup = groupColumn(query.groupBy);
          // Keep statements sequential on the interactive transaction's single
          // connection while the repeatable-read snapshot keeps them consistent.
          const countRows = await transaction.$queryRaw<
            Array<{ count: number }>
          >(Prisma.sql`
              SELECT COUNT(*)::integer AS count
              FROM employees e
              INNER JOIN current_salaries s ON s.employee_id = e.id
              ${organizationWhere}
            `);
          const summaryRows = await transaction.$queryRaw<AggregateRow[]>(
            Prisma.sql`
              WITH filtered AS (
                SELECT s.annual_base_amount AS amount
                FROM employees e
                INNER JOIN current_salaries s ON s.employee_id = e.id
                ${selectedCurrencyWhere}
              ), ranked AS (
                SELECT amount,
                       ROW_NUMBER() OVER (ORDER BY amount) AS row_number,
                       COUNT(*) OVER () AS row_count
                FROM filtered
              )
              SELECT COUNT(*)::integer AS "employeeCount",
                     COALESCE(SUM(amount), 0)::numeric AS "totalAnnualBaseAmount",
                     AVG(amount)::numeric AS "averageAnnualBaseAmount",
                     AVG(amount) FILTER (
                       WHERE row_number IN ((row_count + 1) / 2, (row_count + 2) / 2)
                     )::numeric AS "medianAnnualBaseAmount"
              FROM ranked
            `,
          );
          const groupRows = await transaction.$queryRaw<GroupRow[]>(
            Prisma.sql`
              WITH filtered AS (
                SELECT ${selectedGroup} AS key, s.annual_base_amount AS amount
                FROM employees e
                INNER JOIN current_salaries s ON s.employee_id = e.id
                ${selectedCurrencyWhere}
              ), ranked AS (
                SELECT key, amount,
                       ROW_NUMBER() OVER (PARTITION BY key ORDER BY amount) AS row_number,
                       COUNT(*) OVER (PARTITION BY key) AS row_count
                FROM filtered
              )
              SELECT key,
                     COUNT(*)::integer AS "employeeCount",
                     SUM(amount)::numeric AS "totalAnnualBaseAmount",
                     AVG(amount)::numeric AS "averageAnnualBaseAmount",
                     AVG(amount) FILTER (
                       WHERE row_number IN ((row_count + 1) / 2, (row_count + 2) / 2)
                     )::numeric AS "medianAnnualBaseAmount"
              FROM ranked
              GROUP BY key
              ORDER BY key ASC
            `,
          );
          const summary = summaryRows[0];
          if (!summary)
            throw new Error('Salary report summary was not returned.');
          return {
            data: {
              currencyCode: query.currencyCode,
              groupBy: query.groupBy,
              filters: {
                countryCode: query.countryCode ?? null,
                department: query.department ?? null,
                jobLevel: query.jobLevel ?? null,
              },
              matchingEmployeeCountAllCurrencies: countRows[0]?.count ?? 0,
              summary: serializeStatistics(summary, query.currencyCode),
              groups: groupRows.map((row) => ({
                key: row.key,
                ...serializeStatistics(row, query.currencyCode),
              })),
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
