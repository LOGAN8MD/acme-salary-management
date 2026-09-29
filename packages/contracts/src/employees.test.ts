import { describe, expect, it } from 'vitest';
import {
  employeeDirectoryQuerySchema,
  employeeIdSchema,
  salaryHistoryQuerySchema,
  salaryReportQuerySchema,
  salaryReportResponseSchema,
  salaryUpdateInputSchema,
} from './index.js';

describe('employee directory query', () => {
  it('applies stable defaults and trims optional filters', () => {
    expect(
      employeeDirectoryQuerySchema.parse({ search: '  ACME-10  ' }),
    ).toEqual({
      search: 'ACME-10',
      page: 1,
      pageSize: 25,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('rejects invalid pages, unknown keys, and salary sorting without currency', () => {
    expect(employeeDirectoryQuerySchema.safeParse({ page: '0' }).success).toBe(
      false,
    );
    expect(
      employeeDirectoryQuerySchema.safeParse({ unsupported: 'value' }).success,
    ).toBe(false);
    expect(
      employeeDirectoryQuerySchema.safeParse({
        sortBy: 'annualBaseAmount',
      }).success,
    ).toBe(false);
  });
});

describe('salary report contracts', () => {
  it('requires a supported currency, trims filters, and defaults grouping', () => {
    expect(
      salaryReportQuerySchema.parse({
        currencyCode: 'INR',
        department: '  Engineering  ',
      }),
    ).toEqual({
      currencyCode: 'INR',
      department: 'Engineering',
      groupBy: 'department',
    });
    expect(salaryReportQuerySchema.safeParse({}).success).toBe(false);
    expect(
      salaryReportQuerySchema.safeParse({ currencyCode: 'CAD' }).success,
    ).toBe(false);
    expect(
      salaryReportQuerySchema.safeParse({
        currencyCode: 'USD',
        page: '1',
      }).success,
    ).toBe(false);
  });

  it('accepts nullable statistics for an empty selected currency', () => {
    expect(
      salaryReportResponseSchema.safeParse({
        data: {
          currencyCode: 'GBP',
          groupBy: 'department',
          filters: {
            countryCode: null,
            department: null,
            jobLevel: null,
          },
          matchingEmployeeCountAllCurrencies: 3,
          summary: {
            employeeCount: 0,
            totalAnnualBaseAmount: '0.00',
            averageAnnualBaseAmount: null,
            medianAnnualBaseAmount: null,
          },
          groups: [],
        },
      }).success,
    ).toBe(true);
  });
});

describe('employee detail queries', () => {
  it('validates UUID identifiers and paginated history defaults', () => {
    expect(
      employeeIdSchema.safeParse('00000000-0000-4000-8000-000000000001')
        .success,
    ).toBe(true);
    expect(employeeIdSchema.safeParse('not-an-id').success).toBe(false);
    expect(salaryHistoryQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
    });
    expect(
      salaryHistoryQuerySchema.safeParse({ pageSize: '101' }).success,
    ).toBe(false);
  });
});

describe('salary update input', () => {
  it('accepts exact plain decimals and trims the reason', () => {
    expect(
      salaryUpdateInputSchema.parse({
        annualBaseAmount: '1900000.5',
        reason: '  Promotion review  ',
        expectedVersion: 2,
      }),
    ).toEqual({
      annualBaseAmount: '1900000.5',
      reason: 'Promotion review',
      expectedVersion: 2,
    });
  });

  it.each(['0', '-1', '1.234', '1,000', '1e3', '$100', '10000000000000000.00'])(
    'rejects invalid amount %s',
    (annualBaseAmount) => {
      expect(
        salaryUpdateInputSchema.safeParse({
          annualBaseAmount,
          reason: 'Salary review',
          expectedVersion: 1,
        }).success,
      ).toBe(false);
    },
  );

  it('rejects unknown mutation fields', () => {
    expect(
      salaryUpdateInputSchema.safeParse({
        annualBaseAmount: '100',
        reason: 'Salary review',
        expectedVersion: 1,
        currencyCode: 'USD',
      }).success,
    ).toBe(false);
  });
});
