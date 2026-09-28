import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeeDetail } from './EmployeeDetail';

const employeeId = '00000000-0000-4000-8000-000000000001';
const employee = {
  id: employeeId,
  employeeCode: 'ACME-000001',
  name: 'Asha Rao',
  email: 'asha@example.test',
  countryCode: 'IN',
  department: 'Engineering',
  jobLevel: 'L2',
  salary: {
    annualBaseAmount: '1800000.00',
    currencyCode: 'INR',
    version: 2,
    updatedAt: '2026-09-28T00:00:00.000Z',
  },
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/employees/${employeeId}`]}>
        <Routes>
          <Route path="/employees/:employeeId" element={<EmployeeDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.restoreAllMocks());

describe('employee detail', () => {
  it('shows profile, current salary, revisions, and initialization clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('/salary-history')
        ? {
            data: [
              {
                id: '10000000-0000-4000-8000-000000000002',
                kind: 'REVISION',
                previousAmount: '1700000.00',
                newAmount: '1800000.00',
                currencyCode: 'INR',
                reason: 'Annual salary review',
                changedBy: {
                  id: '20000000-0000-4000-8000-000000000001',
                  email: 'hr@example.test',
                },
                salaryVersion: 2,
                recordedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '10000000-0000-4000-8000-000000000001',
                kind: 'INITIAL',
                previousAmount: null,
                newAmount: '1700000.00',
                currencyCode: 'INR',
                reason: 'Seed initialization',
                changedBy: null,
                salaryVersion: 1,
                recordedAt: '2025-01-01T00:00:00.000Z',
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              totalItems: 2,
              totalPages: 1,
            },
          }
        : { data: employee };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    mount();
    expect(
      await screen.findByRole('heading', { name: 'Asha Rao', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getAllByText(/₹1,800,000\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Annual salary review')).toBeInTheDocument();
    expect(screen.getByText('System initialization')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to employees/ }),
    ).toHaveAttribute('href', '/employees');
  });

  it('validates and submits a salary update with CSRF, then confirms success', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      requests.push({ url, method });
      let body: unknown;
      if (url.endsWith('/api/v1/auth/csrf'))
        body = { data: { csrfToken: 'a'.repeat(64) } };
      else if (method === 'PATCH')
        body = {
          data: {
            salary: {
              ...employee.salary,
              annualBaseAmount: '1900000.00',
              version: 3,
            },
            change: {
              id: '10000000-0000-4000-8000-000000000003',
              kind: 'REVISION',
              previousAmount: '1800000.00',
              newAmount: '1900000.00',
              currencyCode: 'INR',
              reason: 'Promotion review',
              changedBy: {
                id: '20000000-0000-4000-8000-000000000001',
                email: 'hr@example.test',
              },
              salaryVersion: 3,
              recordedAt: '2026-09-28T00:00:00.000Z',
            },
          },
        };
      else if (url.includes('/salary-history'))
        body = {
          data: [],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
          },
        };
      else body = { data: employee };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    mount();
    await screen.findByRole('heading', { name: 'Asha Rao' });
    fireEvent.click(screen.getByRole('button', { name: 'Update salary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }));
    expect(
      screen.getByText('Enter an amount different from the current salary.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enter a reason of at least 3 characters.'),
    ).toBeInTheDocument();
    expect(requests.some(({ method }) => method === 'PATCH')).toBe(false);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'New amount (INR)' }),
      {
        target: { value: '1900000' },
      },
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Promotion review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }));
    expect(
      await screen.findByText('Salary updated to INR 1900000.00.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(requests.some(({ method }) => method === 'PATCH')).toBe(true),
    );
    expect(requests.some(({ url }) => url.endsWith('/api/v1/auth/csrf'))).toBe(
      true,
    );
  });
});
