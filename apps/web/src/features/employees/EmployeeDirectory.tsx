import { useState, type FormEvent } from 'react';
import {
  Button,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import type { Employee, EmployeeDirectoryQuery } from '@acme/contracts';
import { DataTable, type TableColumn } from '../../components/DataTable';
import { FormField } from '../../components/FormField';
import { PageHeader } from '../../components/PageHeader';
import {
  directoryParams,
  directoryQueryFromParams,
  fetchEmployeeFilterOptions,
  fetchEmployees,
} from './api';

type Filters = Pick<
  EmployeeDirectoryQuery,
  | 'search'
  | 'countryCode'
  | 'department'
  | 'jobLevel'
  | 'currencyCode'
  | 'sortBy'
  | 'sortOrder'
>;
const columns: TableColumn<Employee>[] = [
  {
    id: 'employee',
    label: 'Employee',
    render: (employee) => (
      <Stack spacing={0.25}>
        <Typography
          component={Link}
          to={`/employees/${employee.id}`}
          sx={{ color: 'primary.main', fontWeight: 600 }}
        >
          {employee.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {employee.employeeCode} · {employee.email}
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'location',
    label: 'Location',
    render: (employee) => employee.countryCode,
  },
  {
    id: 'role',
    label: 'Department / level',
    render: (employee) => `${employee.department} · ${employee.jobLevel}`,
  },
  {
    id: 'salary',
    label: 'Annual base salary',
    align: 'right',
    render: (employee) =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: employee.salary.currencyCode,
        maximumFractionDigits: employee.salary.currencyCode === 'JPY' ? 0 : 2,
      }).format(Number(employee.salary.annualBaseAmount)),
  },
];
const toFilters = (query: EmployeeDirectoryQuery): Filters => ({
  search: query.search,
  countryCode: query.countryCode,
  department: query.department,
  jobLevel: query.jobLevel,
  currencyCode: query.currencyCode,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

export function EmployeeDirectory() {
  const [params] = useSearchParams();
  return <EmployeeDirectoryContent key={params.toString()} />;
}

function EmployeeDirectoryContent() {
  const [params, setParams] = useSearchParams();
  const query = directoryQueryFromParams(params);
  const [filters, setFilters] = useState<Filters>(() => toFilters(query));
  const options = useQuery({
    queryKey: ['employees', 'filter-options'],
    queryFn: fetchEmployeeFilterOptions,
    staleTime: 5 * 60_000,
  });
  const employees = useQuery({
    queryKey: ['employees', 'directory', query],
    queryFn: () => fetchEmployees(query),
    placeholderData: (previous) => previous,
  });
  const salarySortNeedsCurrency =
    filters.sortBy === 'annualBaseAmount' && !filters.currencyCode;
  const update = <Key extends keyof Filters>(key: Key, value: Filters[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (salarySortNeedsCurrency) return;
    setParams(directoryParams({ ...query, ...filters, page: 1 }));
  };
  const clear = () => setParams(new URLSearchParams());
  const filterOptions = options.data ?? {
    countryCodes: [],
    departments: [],
    jobLevels: [],
    currencyCodes: [],
  };
  return (
    <>
      <PageHeader
        title="Employees"
        description="Search and compare current annual base salaries across the organization."
      />
      <Paper
        component="form"
        onSubmit={submit}
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, mb: 3 }}
        aria-label="Employee filters"
      >
        <Stack spacing={2}>
          <FormField
            label="Search by name or employee code"
            value={filters.search ?? ''}
            onChange={(event) => update('search', event.target.value)}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {(
              [
                ['countryCode', 'Country', filterOptions.countryCodes],
                ['department', 'Department', filterOptions.departments],
                ['jobLevel', 'Job level', filterOptions.jobLevels],
                ['currencyCode', 'Currency', filterOptions.currencyCodes],
              ] as const
            ).map(([key, label, values]) => (
              <FormField
                key={key}
                select
                label={label}
                value={filters[key] ?? ''}
                onChange={(event) => update(key, event.target.value)}
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormField
              select
              label="Sort by"
              value={filters.sortBy}
              onChange={(event) =>
                update('sortBy', event.target.value as Filters['sortBy'])
              }
              {...(salarySortNeedsCurrency
                ? {
                    validationMessage:
                      'Choose a currency before sorting by salary.',
                  }
                : {})}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="employeeCode">Employee code</MenuItem>
              <MenuItem value="annualBaseAmount">Annual salary</MenuItem>
            </FormField>
            <FormField
              select
              label="Order"
              value={filters.sortOrder}
              onChange={(event) =>
                update('sortOrder', event.target.value as Filters['sortOrder'])
              }
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </FormField>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              type="submit"
              variant="contained"
              disabled={salarySortNeedsCurrency}
            >
              Apply filters
            </Button>
            <Button type="button" onClick={clear}>
              Clear
            </Button>
          </Stack>
        </Stack>
      </Paper>
      {employees.data && (
        <Typography sx={{ mb: 1 }} aria-live="polite">
          {employees.data.pagination.totalItems.toLocaleString()} employees
        </Typography>
      )}
      <DataTable
        caption="Employee directory"
        columns={columns}
        rows={employees.data?.data ?? []}
        rowKey={(employee) => employee.id}
        loading={employees.isPending}
        {...(employees.error ? { error: employees.error.message } : {})}
        onRetry={() => void employees.refetch()}
        emptyTitle="No employees found"
        emptyDescription="Try clearing or changing the current filters."
      />
      {employees.data && employees.data.pagination.totalPages > 1 && (
        <Stack sx={{ mt: 3, alignItems: 'center' }}>
          <Pagination
            page={query.page}
            count={employees.data.pagination.totalPages}
            onChange={(_event, page) =>
              setParams(directoryParams({ ...query, page }))
            }
            color="primary"
            showFirstButton
            showLastButton
          />
        </Stack>
      )}
    </>
  );
}
