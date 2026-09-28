import { describe, expect, it } from 'vitest';
import { employeeDirectoryQuerySchema } from './index.js';

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
