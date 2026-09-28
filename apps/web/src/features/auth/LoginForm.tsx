import { useState, type FormEvent } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loginInputSchema } from '@acme/contracts';
import { login } from './api';
import { FormField } from '../../components/FormField';

export function LoginForm() {
  const client = useQueryClient();
  const [validation, setValidation] = useState('');
  const mutation = useMutation({
    mutationFn: login,
    gcTime: 0,
    retry: false,
    onSuccess: async (user) => {
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
      client.setQueryData(['auth', 'me'], user);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const form = new FormData(event.currentTarget);
    const parsed = loginInputSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      setValidation(
        'Enter a valid email and password (maximum 128 characters).',
      );
      return;
    }
    setValidation('');
    mutation.mutate(parsed.data);
  }
  return (
    <Stack
      component="form"
      onSubmit={submit}
      spacing={3}
      aria-label="HR sign in"
    >
      <div>
        <Typography component="h1" variant="h4" gutterBottom>
          Sign in
        </Typography>
        <Typography color="text.secondary">
          Access your HR salary workspace.
        </Typography>
      </div>
      {(validation || mutation.error) && (
        <Alert severity="error">{validation || mutation.error?.message}</Alert>
      )}
      <FormField
        label="Email address"
        name="email"
        type="email"
        autoComplete="username"
        required
        fullWidth
        disabled={mutation.isPending}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        fullWidth
        disabled={mutation.isPending}
        slotProps={{ htmlInput: { maxLength: 128 } }}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </Stack>
  );
}
