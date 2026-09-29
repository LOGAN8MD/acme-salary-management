import { useState, type FormEvent } from 'react';
import { Box, Button, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import type { SalaryReport, SalaryReportQuery } from '@acme/contracts';
import { DataTable, type TableColumn } from '../../components/DataTable';
import { FormField } from '../../components/FormField';
import { PageHeader } from '../../components/PageHeader';
import { fetchEmployeeFilterOptions } from '../employees/api';
import { fetchSalaryReport, reportParams, reportQueryFromParams } from './api';

type Filters = SalaryReportQuery;
type Group = SalaryReport['groups'][number];
const currencies = ['INR', 'USD', 'GBP', 'EUR', 'JPY'] as const;
const groupLabels: Record<SalaryReportQuery['groupBy'], string> = {
  countryCode: 'Country',
  department: 'Department',
  jobLevel: 'Job level',
};

function money(value: string | null, currencyCode: string) {
  if (value === null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
  }).format(Number(value));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function SalaryDashboard() {
  const [params] = useSearchParams();
  return <SalaryDashboardContent key={params.toString()} />;
}

function SalaryDashboardContent() {
  const [params, setParams] = useSearchParams();
  const query = reportQueryFromParams(params);
  const [filters, setFilters] = useState<Filters>(query);
  const options = useQuery({
    queryKey: ['employees', 'filter-options'],
    queryFn: fetchEmployeeFilterOptions,
    staleTime: 5 * 60_000,
  });
  const report = useQuery({
    queryKey: ['reports', 'salaries', query],
    queryFn: () => fetchSalaryReport(query),
  });
  const update = <Key extends keyof Filters>(key: Key, value: Filters[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setParams(reportParams(filters));
  };
  const clear = () =>
    setParams(reportParams({ currencyCode: 'INR', groupBy: 'department' }));
  const filterOptions = options.data ?? {
    countryCodes: [],
    departments: [],
    jobLevels: [],
    currencyCodes: [],
  };
  const columns: TableColumn<Group>[] = [
    {
      id: 'group',
      label: groupLabels[query.groupBy],
      render: (group) => group.key,
    },
    {
      id: 'employees',
      label: 'Employees',
      align: 'right',
      render: (group) => group.employeeCount.toLocaleString(),
    },
    {
      id: 'total',
      label: 'Total annual salary',
      align: 'right',
      render: (group) => money(group.totalAnnualBaseAmount, query.currencyCode),
    },
    {
      id: 'average',
      label: 'Average',
      align: 'right',
      render: (group) =>
        money(group.averageAnnualBaseAmount, query.currencyCode),
    },
    {
      id: 'median',
      label: 'Median',
      align: 'right',
      render: (group) =>
        money(group.medianAnnualBaseAmount, query.currencyCode),
    },
  ];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Review annual base salary totals and distributions without combining currencies."
      />
      <Paper
        component="form"
        onSubmit={submit}
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, mb: 3 }}
        aria-label="Salary report filters"
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormField
              select
              required
              label="Currency"
              value={filters.currencyCode}
              onChange={(event) =>
                update(
                  'currencyCode',
                  event.target.value as Filters['currencyCode'],
                )
              }
            >
              {currencies.map((currency) => (
                <MenuItem key={currency} value={currency}>
                  {currency}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              select
              label="Group by"
              value={filters.groupBy}
              onChange={(event) =>
                update('groupBy', event.target.value as Filters['groupBy'])
              }
            >
              {Object.entries(groupLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </FormField>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {(
              [
                ['countryCode', 'Country', filterOptions.countryCodes],
                ['department', 'Department', filterOptions.departments],
                ['jobLevel', 'Job level', filterOptions.jobLevels],
              ] as const
            ).map(([key, label, values]) => (
              <FormField
                key={key}
                select
                label={label}
                value={filters[key] ?? ''}
                onChange={(event) =>
                  update(key, event.target.value || undefined)
                }
                disabled={options.isPending}
              >
                <MenuItem value="">All</MenuItem>
                {values.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </FormField>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained">
              Apply filters
            </Button>
            <Button type="button" onClick={clear}>
              Clear
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {report.data && (
        <>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {report.data.matchingEmployeeCountAllCurrencies.toLocaleString()}{' '}
            employees match the organization filters. Monetary figures include{' '}
            {report.data.summary.employeeCount.toLocaleString()} employees paid
            in {report.data.currencyCode}.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 2,
              mb: 3,
            }}
          >
            <Metric
              label={`Employees paid in ${report.data.currencyCode}`}
              value={report.data.summary.employeeCount.toLocaleString()}
            />
            <Metric
              label="Total annual base salary"
              value={money(
                report.data.summary.totalAnnualBaseAmount,
                report.data.currencyCode,
              )}
            />
            <Metric
              label="Average annual base salary"
              value={money(
                report.data.summary.averageAnnualBaseAmount,
                report.data.currencyCode,
              )}
            />
            <Metric
              label="Median annual base salary"
              value={money(
                report.data.summary.medianAnnualBaseAmount,
                report.data.currencyCode,
              )}
            />
          </Box>
        </>
      )}
      <DataTable
        caption={`Salary by ${groupLabels[query.groupBy].toLowerCase()}`}
        columns={columns}
        rows={report.data?.groups ?? []}
        rowKey={(group) => group.key}
        loading={report.isPending}
        {...(report.error ? { error: report.error.message } : {})}
        onRetry={() => void report.refetch()}
        emptyTitle={`No ${query.currencyCode} salaries found`}
        emptyDescription="Try another currency or clear the organization filters."
      />
    </>
  );
}
