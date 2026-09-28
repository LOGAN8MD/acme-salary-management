import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import type { Employee } from '@acme/contracts';
import { FormField } from '../../components/FormField';
import { ApiError } from '../auth/api';
import { updateEmployeeSalary } from './api';

function validateAmount(value: string, currency: string, current: string) {
  const pattern =
    currency === 'JPY'
      ? /^(?:0|[1-9]\d{0,15})$/
      : /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
  if (!pattern.test(value) || !/[1-9]/.test(value))
    return currency === 'JPY'
      ? 'Enter a positive whole amount with up to 16 digits.'
      : 'Enter a positive amount with up to 16 whole digits and 2 decimals.';
  const decimals = currency === 'JPY' ? 0 : 2;
  const normalize = (amount: string) => {
    const [whole = '0', fraction = ''] = amount.split('.');
    return `${BigInt(whole)}:${fraction.padEnd(decimals, '0')}`;
  };
  return normalize(value) === normalize(current)
    ? 'Enter an amount different from the current salary.'
    : undefined;
}

export function SalaryUpdateForm({ employee }: { employee: Employee }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(employee.salary.annualBaseAmount);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState<string>();
  const amountError = validateAmount(
    amount,
    employee.salary.currencyCode,
    employee.salary.annualBaseAmount,
  );
  const reasonError =
    reason.trim().length < 3
      ? 'Enter a reason of at least 3 characters.'
      : reason.trim().length > 500
        ? 'Keep the reason within 500 characters.'
        : undefined;
  const mutation = useMutation({
    mutationFn: () =>
      updateEmployeeSalary(employee.id, {
        annualBaseAmount: amount,
        reason: reason.trim(),
        expectedVersion: employee.salary.version,
      }),
    retry: false,
    onSuccess: async (result) => {
      setOpen(false);
      setSubmitted(false);
      setReason('');
      setSuccess(
        `Salary updated to ${result.salary.currencyCode} ${result.salary.annualBaseAmount}.`,
      );
      const next = new URLSearchParams(params);
      next.delete('historyPage');
      setParams(next, { replace: true });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['employees'] }),
        client.invalidateQueries({ queryKey: ['reports'] }),
      ]);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.code === 'SALARY_VERSION_CONFLICT')
        await client.invalidateQueries({ queryKey: ['employees'] });
    },
  });
  const start = () => {
    setAmount(employee.salary.annualBaseAmount);
    setReason('');
    setSubmitted(false);
    setSuccess(undefined);
    mutation.reset();
    setOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!amountError && !reasonError) mutation.mutate();
  };
  const mutationMessage = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : 'The update outcome is uncertain. Close this form and refresh the employee before trying again.'
    : undefined;

  return (
    <>
      {success && (
        <Alert
          severity="success"
          sx={{ mt: 2 }}
          onClose={() => setSuccess(undefined)}
        >
          {success}
        </Alert>
      )}
      <Button variant="contained" sx={{ mt: 3 }} onClick={start}>
        Update salary
      </Button>
      <Dialog open={open} onClose={() => !mutation.isPending && setOpen(false)}>
        <form onSubmit={submit}>
          <DialogTitle>Update annual base salary</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1, minWidth: { sm: 420 } }}>
              <Typography color="text.secondary">
                Current salary: {employee.salary.currencyCode}{' '}
                {employee.salary.annualBaseAmount} · Version{' '}
                {employee.salary.version}
              </Typography>
              <FormField
                label={`New amount (${employee.salary.currencyCode})`}
                value={amount}
                onChange={(event) => setAmount(event.target.value.trim())}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                {...(submitted && amountError
                  ? { validationMessage: amountError }
                  : {})}
              />
              <FormField
                label="Reason"
                value={reason}
                multiline
                minRows={3}
                onChange={(event) => setReason(event.target.value)}
                helperText={`${reason.trim().length}/500 characters`}
                {...(submitted && reasonError
                  ? { validationMessage: reasonError }
                  : {})}
              />
              {mutationMessage && (
                <Alert severity="error">{mutationMessage}</Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Updating…' : 'Confirm update'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
