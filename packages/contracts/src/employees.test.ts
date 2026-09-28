import { describe, expect, it } from 'vitest';
import {
  employeeDirectoryQuerySchema,
  employeeIdSchema,
  salaryHistoryQuerySchema,
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
