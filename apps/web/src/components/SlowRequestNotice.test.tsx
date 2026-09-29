import { act, render, screen } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlowRequestNotice } from './SlowRequestNotice';

afterEach(() => vi.useRealTimers());

describe('SlowRequestNotice', () => {
  it('appears after three seconds and clears when the request settles', async () => {
    vi.useFakeTimers();
    let finishRequest!: () => void;
    const request = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function PendingQuery() {
      useQuery({ queryKey: ['slow-request'], queryFn: () => request });
      return <SlowRequestNotice />;
    }

    render(
      <QueryClientProvider client={client}>
        <PendingQuery />
      </QueryClientProvider>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => vi.advanceTimersByTimeAsync(2_999));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole('status')).toHaveTextContent(
      'The service is waking up',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Please wait about 10 seconds',
    );

    await act(async () => {
      finishRequest();
      await request;
      await vi.runAllTimersAsync();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
