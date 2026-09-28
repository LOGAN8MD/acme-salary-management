import { z } from 'zod';

export const loginInputSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(128),
});
export const hrUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  role: z.literal('HR_MANAGER'),
});
export const csrfResponseSchema = z.object({
  data: z.object({ csrfToken: z.string().regex(/^[a-f0-9]{64}$/) }),
});
export const meResponseSchema = z.object({
  data: z.object({ user: hrUserSchema }),
});
export const loginResponseSchema = z.object({
  data: z.object({
    user: hrUserSchema,
    csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export type LoginInput = z.infer<typeof loginInputSchema>;
export type HrUser = z.infer<typeof hrUserSchema>;

const optionalQueryText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === ''
        ? undefined
        : typeof value === 'string'
          ? value.trim()
          : value,
    z.string().max(max).optional(),
  );
const queryInteger = (fallback: number, maximum?: number) =>
  z.preprocess(
    (value) => (value === undefined ? fallback : value),
    z.coerce
      .number()
      .int()
      .min(1)
      .max(maximum ?? Number.MAX_SAFE_INTEGER),
  );
export const employeeDirectoryQuerySchema = z
  .strictObject({
    search: optionalQueryText(100),
    countryCode: optionalQueryText(2),
    department: optionalQueryText(100),
    jobLevel: optionalQueryText(32),
    currencyCode: optionalQueryText(3),
    page: queryInteger(1),
    pageSize: queryInteger(25, 100),
    sortBy: z
      .enum(['name', 'employeeCode', 'annualBaseAmount'])
      .default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine((query, context) => {
    if (query.sortBy === 'annualBaseAmount' && !query.currencyCode)
      context.addIssue({
        code: 'custom',
        path: ['currencyCode'],
        message: 'Currency is required when sorting by salary.',
      });
  });
export const employeeSalarySchema = z.strictObject({
  annualBaseAmount: z.string().regex(/^\d+(?:\.\d{2})?$/),
  currencyCode: z.string().length(3),
  version: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
});
export const employeeSchema = z.strictObject({
  id: z.uuid(),
  employeeCode: z.string(),
  name: z.string(),
  email: z.email(),
  countryCode: z.string().length(2),
  department: z.string(),
  jobLevel: z.string(),
  salary: employeeSalarySchema,
});
export const paginationSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export const employeeDirectoryResponseSchema = z.strictObject({
  data: z.array(employeeSchema),
  pagination: paginationSchema,
});
export const employeeFilterOptionsResponseSchema = z.strictObject({
  data: z.strictObject({
    countryCodes: z.array(z.string().length(2)),
    departments: z.array(z.string()),
    jobLevels: z.array(z.string()),
    currencyCodes: z.array(z.string().length(3)),
  }),
});
export const employeeIdSchema = z.uuid();
export const employeeDetailResponseSchema = z.strictObject({
  data: employeeSchema,
});
export const salaryHistoryQuerySchema = z.strictObject({
  page: queryInteger(1),
  pageSize: queryInteger(25, 100),
});
export const salaryChangeSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(['INITIAL', 'REVISION']),
  previousAmount: z
    .string()
    .regex(/^\d+(?:\.\d{2})?$/)
    .nullable(),
  newAmount: z.string().regex(/^\d+(?:\.\d{2})?$/),
  currencyCode: z.string().length(3),
  reason: z.string(),
  changedBy: z.strictObject({ id: z.uuid(), email: z.email() }).nullable(),
  salaryVersion: z.number().int().positive(),
  recordedAt: z.iso.datetime(),
});
export const salaryHistoryResponseSchema = z.strictObject({
  data: z.array(salaryChangeSchema),
  pagination: paginationSchema,
});
export type EmployeeDirectoryQuery = z.infer<
  typeof employeeDirectoryQuerySchema
>;
export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeFilterOptions = z.infer<
  typeof employeeFilterOptionsResponseSchema
>['data'];
export type SalaryHistoryQuery = z.infer<typeof salaryHistoryQuerySchema>;
export type SalaryChange = z.infer<typeof salaryChangeSchema>;
