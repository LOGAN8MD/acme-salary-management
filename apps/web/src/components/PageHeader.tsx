import { useEffect, useRef, type ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · ACME Salary Management`;
    heading.current?.focus();
  }, [title]);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{
        mb: 4,
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: 2,
      }}
    >
      <div>
        <Typography
          ref={heading}
          tabIndex={-1}
          component="h1"
          variant="h4"
          sx={{ fontWeight: 650, outline: 'none' }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      </div>
      {action}
    </Stack>
  );
}
