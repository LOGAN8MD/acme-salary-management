import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request, { type Response } from 'supertest';
import { createApp } from '../../app.js';
import { createDatabaseClient } from '../../db/client.js';
import { hashSeedPassword } from '../../db/seed/password.js';
import { SESSION_LIFETIME_MS, tokenHash } from './service.js';

if (
  !process.env.DATABASE_URL ||
  process.env.ACME_DISPOSABLE_DATABASE !== process.env.DATABASE_URL
)
  throw new Error('Use npm run test:db.');
const db = createDatabaseClient();
const origin = 'http://127.0.0.1:5173';
const credentials = {
  email: 'hr@example.test',
  password: 'AuthTestPassword2026!',
};
let passwordHash: string;
let clock: Date;
let app: ReturnType<typeof createApp>;
const cookie = (response: Response) =>
  (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
beforeAll(async () => {
  passwordHash = await hashSeedPassword(credentials.password);
});
beforeEach(async () => {
  await db.salaryChange.deleteMany();
  await db.currentSalary.deleteMany();
  await db.session.deleteMany();
  await db.employee.deleteMany();
  await db.hrUser.deleteMany();
  await db.hrUser.create({ data: { email: credentials.email, passwordHash } });
  clock = new Date('2026-09-28T10:00:00.000Z');
  app = createApp({
    db,
    auth: { origin, secureCookies: false },
    now: () => clock,
  });
});
afterAll(() => db.$disconnect());
async function signIn() {
  const initial = await request(app).get('/api/v1/auth/csrf');
  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .set('Cookie', cookie(initial))
    .set('X-CSRF-Token', initial.body.data.csrfToken)
    .send(credentials);
  expect(login.status).toBe(200);
  return { initial, login };
}

describe('HR authentication', () => {
  it('rotates sessions and CSRF, persists only hashes, restores after app recreation, and revokes logout', async () => {
    const { initial, login } = await signIn();
    const authenticatedCookie = cookie(login);
    const raw = authenticatedCookie.split('=')[1]!;
    expect(authenticatedCookie).not.toBe(cookie(initial));
    expect(login.body.data.csrfToken).not.toBe(initial.body.data.csrfToken);
    expect(login.body.data.user.role).toBe('HR_MANAGER');
    expect(Object.keys(login.body.data.user).sort()).toEqual([
      'email',
      'id',
      'role',
    ]);
    const sessions = await db.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe(tokenHash(raw));
    expect(sessions[0]?.csrfTokenHash).toBe(
      tokenHash(login.body.data.csrfToken),
    );
    expect(sessions[0]?.expiresAt.getTime()).toBe(
      clock.getTime() + SESSION_LIFETIME_MS,
    );
    expect(JSON.stringify(sessions)).not.toContain(raw);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie(initial)))
        .status,
    ).toBe(401);
    const restarted = createApp({
      db,
      auth: { origin, secureCookies: false },
      now: () => clock,
    });
    const me = await request(restarted)
      .get('/api/v1/auth/me')
      .set('Cookie', authenticatedCookie);
    expect(me.status).toBe(200);
    expect(me.headers['cache-control']).toBe('no-store');
    const restored = await request(restarted)
      .get('/api/v1/auth/csrf')
      .set('Cookie', authenticatedCookie);
    expect(restored.body.data.csrfToken).toBe(login.body.data.csrfToken);
    const logout = await request(restarted)
      .post('/api/v1/auth/logout')
      .set('Cookie', authenticatedCookie)
      .set('Origin', origin)
      .set('X-CSRF-Token', login.body.data.csrfToken);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    expect(await db.session.count()).toBe(0);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', authenticatedCookie)
      ).status,
    ).toBe(401);
  });
  it('rejects missing, malformed, anonymous, and expired sessions', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', 'acme-session=garbage')
      ).status,
    ).toBe(401);
    const { initial, login } = await signIn();
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie(initial)))
        .status,
    ).toBe(401);
    clock = new Date(clock.getTime() + SESSION_LIFETIME_MS);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie(login)))
        .status,
    ).toBe(401);
    expect(await db.session.count()).toBe(0);
  });
  it('rejects missing/foreign CSRF tokens and origins without granting access', async () => {
    const first = await request(app).get('/api/v1/auth/csrf');
    const other = await request(app).get('/api/v1/auth/csrf');
    for (const [requestOrigin, token] of [
      [origin, ''],
      ['https://evil.example', first.body.data.csrfToken],
      ['', first.body.data.csrfToken],
      [origin, other.body.data.csrfToken],
    ]) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', cookie(first))
        .set('Origin', requestOrigin!)
        .set('X-CSRF-Token', token!)
        .send(credentials);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CSRF_INVALID');
    }
    expect(
      (
        await request(app)
          .get('/api/v1/auth/csrf')
          .set('Sec-Fetch-Site', 'cross-site')
      ).status,
    ).toBe(403);
    expect(await db.session.count({ where: { userId: { not: null } } })).toBe(
      0,
    );
  });
  it('uses identical errors for unknown email and wrong passwords', async () => {
    const bootstrap = await request(app).get('/api/v1/auth/csrf');
    const failures = [];
    for (const input of [
      { ...credentials, password: 'incorrect' },
      { ...credentials, email: 'unknown@example.test' },
    ]) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', cookie(bootstrap))
        .set('Origin', origin)
        .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
        .send(input);
      expect(response.status).toBe(401);
      failures.push(response.body.error);
    }
    expect(failures[0].code).toBe(failures[1].code);
    expect(failures[0].message).toBe(failures[1].message);
    expect(await db.session.count({ where: { userId: { not: null } } })).toBe(
      0,
    );
  });
  it('validates request bodies and rate-limits repeated login requests', async () => {
    const bootstrap = await request(app).get('/api/v1/auth/csrf');
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', cookie(bootstrap))
        .set('Origin', origin)
        .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
        .send({ ...credentials, role: 'ADMIN' });
      expect(response.status).toBe(400);
    }
    const limited = await request(app)
      .post('/api/v1/auth/login')
      .send(credentials);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
  it('uses production cookie flags and sanitizes malformed JSON errors', async () => {
    const production = createApp({
      db,
      auth: { origin: 'https://acme.example', secureCookies: true },
    });
    const response = await request(production).get('/api/v1/auth/csrf');
    const header = response.headers['set-cookie']?.[0] as string;
    expect(header).toContain('__Host-acme-session=');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'])
      expect(header).toContain(flag);
    const malformed = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.requestId).toBeTruthy();
    expect(malformed.text).not.toContain('SyntaxError');
  });
  it('protects business routes and mutation CSRF before route handlers', async () => {
    expect((await request(app).get('/api/v1/employees')).status).toBe(401);
    expect((await request(app).get('/api/v1/reports/salaries')).status).toBe(
      401,
    );
    const { login } = await signIn();
    const directory = await request(app)
      .get('/api/v1/employees')
      .set('Cookie', cookie(login));
    expect(directory.status).toBe(200);
    expect(directory.body.pagination.totalItems).toBe(0);
    expect(
      (
        await request(app)
          .get('/api/v1/reports/salaries')
          .set('Cookie', cookie(login))
      ).status,
    ).toBe(404);
    const blocked = await request(app)
      .patch('/api/v1/employees/example/salary')
      .set('Cookie', cookie(login))
      .send({});
    expect(blocked.status).toBe(403);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie(login))
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', login.body.data.csrfToken);
    expect(logout.status).toBe(403);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie(login)))
        .status,
    ).toBe(200);
  });
});
