import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
});
