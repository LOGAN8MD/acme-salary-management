import { Button, Paper } from '@mui/material';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/Feedback';

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Understand your organization’s compensation."
      />
      <Paper variant="outlined">
        <EmptyState
          title="Salary reporting is coming soon"
          description="Country, department, and job-level summaries will appear here when reporting is available."
          action={
            <Button component={Link} to="/employees" variant="outlined">
              Go to employees
            </Button>
          }
        />
      </Paper>
    </>
  );
}
export function EmployeesPage() {
  return (
    <>
      <PageHeader
        title="Employees"
        description="Your employee salary directory."
      />
      <Paper variant="outlined">
        <EmptyState
          title="The employee directory is coming soon"
          description="Employee search, filters, and salary details will be available here. This preview does not display employee records yet."
        />
      </Paper>
    </>
  );
}
export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="This address does not match a workspace page."
      />
      <Button component={Link} to="/dashboard" variant="contained">
        Back to dashboard
      </Button>
    </>
  );
}
