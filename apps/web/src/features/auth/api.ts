import {
  csrfResponseSchema,
  loginResponseSchema,
  meResponseSchema,
  type LoginInput,
} from '@acme/contracts';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request(path: string, options?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`/api/v1/auth${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? 'Something went wrong. Please try again.',
    );
  }
  return response.status === 204 ? null : (response.json() as Promise<unknown>);
}
export async function csrfHeaders() {
  const { data } = csrfResponseSchema.parse(await request('/csrf'));
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrfToken };
}
export async function currentUser() {
  try {
    return meResponseSchema.parse(await request('/me')).data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export async function login(input: LoginInput) {
  const body = await request('/login', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
  return loginResponseSchema.parse(body).data.user;
}
export async function logout() {
  try {
    await request('/logout', { method: 'POST', headers: await csrfHeaders() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return;
    throw error;
  }
}
