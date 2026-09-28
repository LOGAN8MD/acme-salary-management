import { Container, Paper, Stack, Typography } from '@mui/material';

export function App() {
  return (
    <Container component="main" maxWidth="sm" sx={{ py: 10 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="overline" color="primary">
            ACME · HR workspace
          </Typography>
          <Typography variant="h4" component="h1">
            Salary Management
          </Typography>
          <Typography color="text.secondary">
            The application foundation is ready. Employee and salary features
            will be added in the next approved stages.
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
