import { Button } from '@mui/material';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { EmployeeDirectory } from '../features/employees/EmployeeDirectory';
import { SalaryDashboard } from '../features/reports/SalaryDashboard';

export function DashboardPage() {
  return <SalaryDashboard />;
}
export function EmployeesPage() {
  return <EmployeeDirectory />;
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
