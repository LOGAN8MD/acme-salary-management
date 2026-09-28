import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LoginForm } from './features/auth/LoginForm';
import { safeReturnPath, useSession } from './features/auth/session';
import { AuthFrame } from './layout/AuthFrame';
import { AppShell } from './layout/AppShell';
import { LoadingState, ErrorState } from './components/Feedback';
import {
  DashboardPage,
  EmployeesPage,
  NotFoundPage,
} from './pages/WorkspacePages';
import { EmployeeDetail } from './features/employees/EmployeeDetail';

function SessionGate() {
  const session = useSession();
  const client = useQueryClient();
  useEffect(() => {
    if (session.data === null) {
      void client
        .cancelQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
        .then(() => {
          client.removeQueries({
            predicate: (query) => query.queryKey[0] !== 'auth',
          });
        });
    }
  }, [session.data, client]);
  if (session.isPending)
    return (
      <AuthFrame>
        <LoadingState label="Checking your session…" />
      </AuthFrame>
    );
  if (session.isError)
    return (
      <AuthFrame>
        <ErrorState
          message="Unable to check your session. Please try again."
          onRetry={() => void session.refetch()}
        />
      </AuthFrame>
    );
  return <Outlet />;
}
function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();
  return session.data ? (
    <Outlet />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search + location.hash }}
    />
  );
}
function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const state = location.state as { from?: unknown } | null;
  useEffect(() => {
    document.title = 'Sign in · ACME Salary Management';
  }, []);
  return session.data ? (
    <Navigate to={safeReturnPath(state?.from)} replace />
  ) : (
    <AuthFrame>
      <LoginForm />
    </AuthFrame>
  );
}
export function App() {
  return (
    <Routes>
      <Route element={<SessionGate />}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/:employeeId" element={<EmployeeDetail />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
