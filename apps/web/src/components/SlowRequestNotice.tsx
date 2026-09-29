import { useEffect, useState } from 'react';
import {
  Backdrop,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

type SlowRequestNoticeProps = {
  delayMs?: number;
};

export function SlowRequestNotice({ delayMs = 3_000 }: SlowRequestNoticeProps) {
  const isBusy = useIsFetching() + useIsMutating() > 0;
  return isBusy ? <DelayedNotice delayMs={delayMs} /> : null;
}

function DelayedNotice({ delayMs }: Required<SlowRequestNoticeProps>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return (
    <Backdrop
      open={visible}
      role="status"
      aria-live="polite"
      transitionDuration={0}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1, padding: 2 }}
    >
      <Paper
        elevation={8}
        sx={{ maxWidth: 440, padding: 4, textAlign: 'center' }}
      >
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress aria-hidden="true" />
          <Typography component="h2" variant="h6">
            The service is waking up
          </Typography>
          <Typography color="text.secondary">
            The free Render instance can spin down after inactivity, which may
            delay requests. Please wait about 10 seconds while it wakes up.
          </Typography>
        </Stack>
      </Paper>
    </Backdrop>
  );
}
