import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { App } from '../../App';

const user = {
  id: 'ac4e0000-0000-4000-8000-000000000001',
  email: 'hr@acme.example.test',
  role: 'HR_MANAGER',
};
const csrf = 'a'.repeat(64);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
afterEach(() => vi.unstubAllGlobals());

describe('HR sign-in screen', () => {
  it('restores an existing session without displaying the login form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => json({ data: { user } })),
    );
    mount();
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
  it('signs in using CSRF and signs out without retaining user data', async () => {
    let signedIn = false;
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith('/me'))
        return signedIn
          ? json({ data: { user } })
          : json({ error: { code: 'UNAUTHENTICATED' } }, 401);
      if (path.endsWith('/csrf')) return json({ data: { csrfToken: csrf } });
      expect(init?.headers).toMatchObject({ 'X-CSRF-Token': csrf });
      if (path.endsWith('/login')) {
        signedIn = true;
        return json({ data: { user, csrfToken: csrf } });
      }
      signedIn = false;
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = mount();
    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'DemoPassword2026!' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'HR sign in' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(client.getQueryData(['auth', 'me'])).toBeNull();
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });
  it('shows invalid-credentials feedback and lets HR retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) =>
        path.endsWith('/csrf')
          ? json({ data: { csrfToken: csrf } })
          : json(
              {
                error: {
                  code: 'INVALID_CREDENTIALS',
                  message: 'Email or password is incorrect.',
                },
              },
              401,
            ),
      ),
    );
    mount();
    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'wrong' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'HR sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.',
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(),
    );
  });
  it('offers retry when session loading fails rather than pretending HR is logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to check your session',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
  });
});
