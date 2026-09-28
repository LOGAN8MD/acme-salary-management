import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeeDirectory } from './EmployeeDirectory';
import { directoryParams, directoryQueryFromParams } from './api';

const employee = {
  id: '00000000-0000-4000-8000-000000000001',
  employeeCode: 'ACME-000001',
  name: 'Asha Rao',
  email: 'asha@example.test',
  countryCode: 'IN',
  department: 'Engineering',
  jobLevel: 'L2',
  salary: {
    annualBaseAmount: '1800000.00',
    currencyCode: 'INR',
    version: 1,
    updatedAt: '2026-09-28T00:00:00.000Z',
  },
};
function LocationProbe() {
  return <output aria-label="location">{useLocation().search}</output>;
}
function mount(route = '/employees') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <EmployeeDirectory />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.restoreAllMocks());

describe('employee directory', () => {
  it('normalizes URL query defaults and only writes non-default values', () => {
    const parsed = directoryQueryFromParams(
      new URLSearchParams('search=%20asha%20&page=2&pageSize=50'),
    );
    expect(parsed).toMatchObject({ search: 'asha', page: 2, pageSize: 50 });
    expect(directoryParams(parsed).toString()).toBe(
      'search=asha&page=2&pageSize=50',
    );
    expect(
      directoryQueryFromParams(new URLSearchParams('page=invalid')),
    ).toMatchObject({ page: 1, pageSize: 25 });
  });

  it('loads employees and applies search through the URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/filter-options'))
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
      const noMatch = url.includes('search=missing');
      return new Response(
        JSON.stringify({
          data: noMatch ? [] : [employee],
          pagination: {
            page: 1,
            pageSize: 25,
            totalItems: noMatch ? 0 : 1,
            totalPages: noMatch ? 0 : 1,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    mount();
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'Search by name or employee code',
      }),
      { target: { value: 'missing' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent(
        '?search=missing',
      ),
    );
    expect(
      await screen.findByRole('heading', { name: 'No employees found' }),
    ).toBeInTheDocument();
  });
});
