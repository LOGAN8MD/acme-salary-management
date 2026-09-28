import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUser, logout } from './features/auth/api';
import { LoginForm } from './features/auth/LoginForm';

export function App() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: currentUser,
    retry: false,
    refetchInterval: (query) => (query.state.data ? 60_000 : false),
  });
  const signOut = useMutation({
    mutationFn: logout,
    retry: false,
    onSuccess: async () => {
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
      client.setQueryData(['auth', 'me'], null);
    },
  });
  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, sm: 10 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Typography variant="overline" color="primary">
            ACME · Salary Management
          </Typography>
          {session.isPending ? (
            <Stack direction="row" spacing={2} role="status">
              <CircularProgress size={22} />
              <Typography>Checking your session…</Typography>
            </Stack>
          ) : session.isError ? (
            <>
              <Alert severity="error">
                Unable to check your session. Please try again.
              </Alert>
              <Button onClick={() => void session.refetch()}>Retry</Button>
            </>
          ) : session.data ? (
            <>
              <Typography component="h1" variant="h4">
                You’re signed in
              </Typography>
              <Typography color="text.secondary">
                {session.data.email}
              </Typography>
              <Typography>
                Your HR account is ready. Employee and salary screens are coming
                next.
              </Typography>
              {signOut.error && (
                <Alert severity="error">{signOut.error.message}</Alert>
              )}
              <Button
                variant="outlined"
                disabled={signOut.isPending}
                onClick={() => signOut.mutate()}
              >
                {signOut.isPending ? 'Signing out…' : 'Sign out'}
              </Button>
            </>
          ) : (
            <LoginForm />
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
