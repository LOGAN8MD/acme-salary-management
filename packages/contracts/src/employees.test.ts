import { describe, expect, it } from 'vitest';
import {
  employeeDirectoryQuerySchema,
  employeeIdSchema,
  salaryHistoryQuerySchema,
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
