import {
  salaryReportQuerySchema,
  salaryReportResponseSchema,
  type SalaryReportQuery,
} from '@acme/contracts';
import { ApiError } from '../auth/api';

export function reportQueryFromParams(params: URLSearchParams) {
  const parsed = salaryReportQuerySchema.safeParse(
    Object.fromEntries(params.entries()),
  );
  return parsed.success
    ? parsed.data
    : salaryReportQuerySchema.parse({ currencyCode: 'INR' });
}

export function reportParams(query: SalaryReportQuery) {
  const params = new URLSearchParams({
    currencyCode: query.currencyCode,
    groupBy: query.groupBy,
  });
  for (const key of ['countryCode', 'department', 'jobLevel'] as const)
    if (query[key]) params.set(key, query[key]);
  return params;
}

export async function fetchSalaryReport(query: SalaryReportQuery) {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/reports/salaries?${reportParams(query).toString()}`,
      { credentials: 'same-origin', cache: 'no-store' },
    );
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
      body?.error?.message ?? 'Unable to load the salary report.',
    );
  }
  return salaryReportResponseSchema.parse(await response.json()).data;
}
