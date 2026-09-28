import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';
import { safeReturnPath } from '../features/auth/session';

const user = {
  id: 'ac4e0000-0000-4000-8000-000000000001',
  email: 'hr@acme.example.test',
  role: 'HR_MANAGER',
};
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Current route">
        {location.pathname + location.search}
      </output>
      <button onClick={() => void navigate(-1)}>Browser back</button>
    </>
  );
}
function mount(path = '/dashboard', desktop = true, authenticated = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  let signedIn = authenticated;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/csrf'))
        return Response.json({ data: { csrfToken: 'a'.repeat(64) } });
      if (url.endsWith('/login')) {
        signedIn = true;
        return Response.json({ data: { user, csrfToken: 'b'.repeat(64) } });
      }
      return signedIn
        ? Response.json({ data: { user } })
        : Response.json(
            { error: { code: 'UNAUTHENTICATED' } },
            { status: 401 },
          );
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    client,
    expire: () => {
      signedIn = false;
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('protected workspace routes', () => {
  it('preserves a direct employee link through login without showing protected content first', async () => {
    mount('/employees?countryCode=IN', true, false);
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'ExamplePassword2026!' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'HR sign in' }));
    await screen.findByRole('heading', { name: 'Employees' });
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/employees?countryCode=IN',
    );
  });
  it('updates active navigation, page focus/title, and supports history back', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Employees' }));
    const heading = await screen.findByRole('heading', {
      name: 'Employees',
    });
    expect(heading).toHaveFocus();
    expect(document.title).toBe('Employees · ACME Salary Management');
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
  });
  it('opens and closes the mobile navigation when choosing a destination', async () => {
    mount('/dashboard', false);
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await screen.findByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(screen.getByRole('link', { name: 'Employees' }));
    await screen.findByRole('heading', { name: 'Employees' });
    await waitFor(() =>
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  it('removes protected content and cached data when a session expires', async () => {
    const { client, expire } = mount('/employees');
    await screen.findByRole('heading', { name: 'Employees' });
    client.setQueryData(
      ['employees'],
      [{ name: 'Sensitive cached test record' }],
    );
    expire();
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['auth', 'me'] });
    });
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(client.getQueryData(['employees'])).toBeUndefined(),
    );
  });
  it('offers a recovery link for unknown paths without inventing a feature', async () => {
    mount('/unknown-page');
    await screen.findByRole('heading', { name: 'Page not found' });
    fireEvent.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
  });
  it('limits return destinations to internal workspace routes', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/login',
      null,
      { from: '/employees' },
    ])
      expect(safeReturnPath(value)).toBe('/dashboard');
    expect(safeReturnPath('/employees?countryCode=IN')).toBe(
      '/employees?countryCode=IN',
    );
  });
});
