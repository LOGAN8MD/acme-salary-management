import {
  Button,
  Chip,
  Divider,
  Pagination,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import type { SalaryChange } from '@acme/contracts';
import { DataTable, type TableColumn } from '../../components/DataTable';
import { ErrorState, LoadingState } from '../../components/Feedback';
import { PageHeader } from '../../components/PageHeader';
import { fetchEmployee, fetchSalaryHistory } from './api';

function money(amount: string, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(Number(amount));
}
const historyColumns: TableColumn<SalaryChange>[] = [
  {
    id: 'change',
    label: 'Change',
    render: (change) =>
      change.kind === 'INITIAL'
        ? `Initialized at ${money(change.newAmount, change.currencyCode)}`
        : `${money(change.previousAmount!, change.currencyCode)} → ${money(change.newAmount, change.currencyCode)}`,
  },
  { id: 'reason', label: 'Reason', render: (change) => change.reason },
  {
    id: 'actor',
    label: 'Changed by',
    render: (change) => change.changedBy?.email ?? 'System initialization',
  },
  {
    id: 'date',
    label: 'Recorded',
    render: (change) =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(change.recordedAt)),
  },
];

export function EmployeeDetail() {
  const { employeeId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const parsedPage = Number(params.get('historyPage') ?? '1');
  const historyPage =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const employee = useQuery({
    queryKey: ['employees', 'detail', employeeId],
    queryFn: () => fetchEmployee(employeeId),
    retry: false,
  });
  const history = useQuery({
    queryKey: ['employees', 'history', employeeId, historyPage],
    queryFn: () => fetchSalaryHistory(employeeId, historyPage),
    retry: false,
    placeholderData: (previous) => previous,
  });

  if (employee.isPending)
    return <LoadingState label="Loading employee details…" />;
  if (employee.error)
    return (
      <ErrorState
        message={employee.error.message}
        onRetry={() => void employee.refetch()}
      />
    );
  const person = employee.data;
  return (
    <>
      <Button component={Link} to="/employees" sx={{ mb: 1 }}>
        ← Back to employees
      </Button>
      <PageHeader title={person.name} description={person.employeeCode} />
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Paper variant="outlined" sx={{ p: 3, flex: 1 }}>
          <Typography component="h2" variant="h6" gutterBottom>
            Employee profile
          </Typography>
          <Stack spacing={1.5} divider={<Divider flexItem />}>
            <Detail label="Email" value={person.email} />
            <Detail label="Country" value={person.countryCode} />
            <Detail label="Department" value={person.department} />
            <Detail label="Job level" value={person.jobLevel} />
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, flex: 1 }}>
          <Typography component="h2" variant="h6" gutterBottom>
            Current annual base salary
          </Typography>
          <Typography variant="h4" sx={{ my: 2 }}>
            {money(person.salary.annualBaseAmount, person.salary.currencyCode)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip label={person.salary.currencyCode} size="small" />
            <Typography color="text.secondary" variant="body2">
              Version {person.salary.version} · Updated{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
              }).format(new Date(person.salary.updatedAt))}
            </Typography>
          </Stack>
        </Paper>
      </Stack>
      <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
        Salary history
      </Typography>
      <DataTable
        caption="Salary history"
        columns={historyColumns}
        rows={history.data?.data ?? []}
        rowKey={(change) => change.id}
        loading={history.isPending}
        {...(history.error ? { error: history.error.message } : {})}
        onRetry={() => void history.refetch()}
        emptyTitle="No salary history"
        emptyDescription="No salary events have been recorded for this employee."
      />
      {history.data && history.data.pagination.totalPages > 1 && (
        <Stack sx={{ mt: 3, alignItems: 'center' }}>
          <Pagination
            page={historyPage}
            count={history.data.pagination.totalPages}
            onChange={(_event, page) => {
              const next = new URLSearchParams(params);
              if (page === 1) next.delete('historyPage');
              else next.set('historyPage', String(page));
              setParams(next);
            }}
            color="primary"
          />
        </Stack>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: 'right', fontWeight: 500 }}>
        {value}
      </Typography>
    </Stack>
  );
}
