import {
  employeeDirectoryQuerySchema,
  employeeDirectoryResponseSchema,
  employeeDetailResponseSchema,
  employeeFilterOptionsResponseSchema,
  salaryHistoryResponseSchema,
  salaryUpdateResponseSchema,
  type EmployeeDirectoryQuery,
  type SalaryUpdateInput,
} from '@acme/contracts';
import { ApiError, csrfHeaders } from '../auth/api';

async function request(path: string, options?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`/api/v1/employees${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? 'Unable to load employees. Please try again.',
    );
  }
  return response.json() as Promise<unknown>;
}

export function directoryQueryFromParams(params: URLSearchParams) {
  const raw = Object.fromEntries(params.entries());
  const parsed = employeeDirectoryQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : employeeDirectoryQuerySchema.parse({});
}
export function directoryParams(query: EmployeeDirectoryQuery) {
  const params = new URLSearchParams();
  for (const key of [
    'search',
    'countryCode',
    'department',
    'jobLevel',
    'currencyCode',
  ] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.pageSize !== 25) params.set('pageSize', String(query.pageSize));
  if (query.sortBy !== 'name') params.set('sortBy', query.sortBy);
  if (query.sortOrder !== 'asc') params.set('sortOrder', query.sortOrder);
  return params;
}
export async function fetchEmployees(query: EmployeeDirectoryQuery) {
  const body = await request(`?${directoryParams(query).toString()}`);
  return employeeDirectoryResponseSchema.parse(body);
}
export async function fetchEmployeeFilterOptions() {
  return employeeFilterOptionsResponseSchema.parse(
    await request('/filter-options'),
  ).data;
}
export async function fetchEmployee(employeeId: string) {
  return employeeDetailResponseSchema.parse(await request(`/${employeeId}`))
    .data;
}
export async function fetchSalaryHistory(
  employeeId: string,
  page: number,
  pageSize = 10,
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return salaryHistoryResponseSchema.parse(
    await request(`/${employeeId}/salary-history?${params.toString()}`),
  );
}
export async function updateEmployeeSalary(
  employeeId: string,
  input: SalaryUpdateInput,
) {
  return salaryUpdateResponseSchema.parse(
    await request(`/${employeeId}/salary`, {
      method: 'PATCH',
      headers: await csrfHeaders(),
      body: JSON.stringify(input),
    }),
  ).data;
}
