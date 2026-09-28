import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { FormField } from './FormField';
const columns = [
  {
    id: 'name',
    label: 'Employee',
    render: (row: { name: string }) => row.name,
  },
];
const props = {
  caption: 'Employee directory',
  columns,
  rows: [{ name: 'Test Employee' }],
  rowKey: (row: { name: string }) => row.name,
  emptyTitle: 'No matches',
  emptyDescription: 'Try another filter.',
};
describe('shared UI states', () => {
  it('prioritizes loading/error states over stale table rows and supports retry', () => {
    const retry = vi.fn();
    const { rerender } = render(<DataTable {...props} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading employee directory',
    );
    expect(screen.queryByText('Test Employee')).not.toBeInTheDocument();
    rerender(
      <DataTable
        {...props}
        error="Unable to fetch employees."
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to fetch employees',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    rerender(<DataTable {...props} rows={[]} />);
    expect(
      screen.getByRole('heading', { name: 'No matches' }),
    ).toBeInTheDocument();
  });
  it('exposes a named table and column headers, and links field errors to inputs', () => {
    render(
      <>
        <DataTable {...props} />
        <FormField label="Reason" validationMessage="A reason is required." />
      </>,
    );
    expect(
      screen.getByRole('table', { name: 'Employee directory' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Employee' }),
    ).toHaveAttribute('scope', 'col');
    expect(
      screen.getByRole('textbox', { name: 'Reason' }),
    ).toHaveAccessibleDescription('A reason is required.');
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
