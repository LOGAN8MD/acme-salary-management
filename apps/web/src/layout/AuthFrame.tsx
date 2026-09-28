import type { ReactNode } from 'react';
import { Container, Paper, Stack, Typography } from '@mui/material';
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, sm: 10 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Typography variant="overline" color="primary">
            ACME · Salary Management
          </Typography>
          {children}
        </Stack>
      </Paper>
    </Container>
  );
}
