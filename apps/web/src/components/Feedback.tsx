import type { ReactNode } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Stack
      role="status"
      aria-live="polite"
      direction="row"
      spacing={2}
      sx={{ py: 4, alignItems: 'center' }}
    >
      <CircularProgress size={24} aria-hidden="true" />
      <Typography>{label}</Typography>
    </Stack>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>Unable to load</AlertTitle>
      {message}
    </Alert>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 5, md: 8 }, px: 3 }}>
      <Typography component="h2" variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ maxWidth: 480, mx: 'auto', mb: action ? 3 : 0 }}
      >
        {description}
      </Typography>
      {action}
    </Box>
  );
}
