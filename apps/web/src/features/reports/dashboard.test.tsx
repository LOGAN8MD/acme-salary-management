import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SalaryDashboard } from './SalaryDashboard';
import { reportParams, reportQueryFromParams } from './api';

function mount(route = '/dashboard') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <SalaryDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.restoreAllMocks());

describe('salary dashboard', () => {
  it('uses a visible INR default and serializes report filters', () => {
    expect(reportQueryFromParams(new URLSearchParams())).toEqual({
      currencyCode: 'INR',
      groupBy: 'department',
    });
    expect(
      reportParams({
        currencyCode: 'USD',
        groupBy: 'jobLevel',
        countryCode: 'US',
      }).toString(),
    ).toBe('currencyCode=USD&groupBy=jobLevel&countryCode=US');
  });

  it('labels the all-currency population and selected-currency metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/employees/filter-options'))
        return new Response(
          JSON.stringify({
            data: {
              countryCodes: ['IN'],
              departments: ['Engineering'],
              jobLevels: ['L2'],
              currencyCodes: ['INR'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      return new Response(
        JSON.stringify({
          data: {
            currencyCode: 'INR',
            groupBy: 'department',
            filters: {
              countryCode: null,
              department: null,
              jobLevel: null,
            },
            matchingEmployeeCountAllCurrencies: 10,
            summary: {
              employeeCount: 2,
              totalAnnualBaseAmount: '3600000.00',
              averageAnnualBaseAmount: '1800000.00',
              medianAnnualBaseAmount: '1800000.00',
            },
            groups: [
              {
                key: 'Engineering',
                employeeCount: 2,
                totalAnnualBaseAmount: '3600000.00',
                averageAnnualBaseAmount: '1800000.00',
                medianAnnualBaseAmount: '1800000.00',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    mount();
    expect(await screen.findByText(/10 employees match/)).toHaveTextContent(
      'Monetary figures include 2 employees paid in INR',
    );
    expect(
      screen.getByText('Employees paid in INR').nextElementSibling,
    ).toHaveTextContent('2');
    expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('region', { name: 'Salary by department' }),
    ).toBeInTheDocument();
  });
});
