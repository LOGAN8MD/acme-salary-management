import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { LoginInput } from '@acme/contracts';
import { verifyPassword } from './password.js';
import { HttpError } from '../../middleware/errors.js';

export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const ANONYMOUS_LIFETIME_MS = 20 * 60 * 1000;
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
// Stable for this session, including across tabs; only its hash is stored in PostgreSQL.
export const csrfToken = (rawSession: string) =>
  createHmac('sha256', rawSession).update('acme-csrf-v1').digest('hex');
export function createAuthService(
  db: PrismaClient,
  now: () => Date = () => new Date(),
) {
  let activeVerifications = 0;
  function sessionData(userId: string | null) {
    const raw = randomBytes(32).toString('hex');
    const createdAt = now();
    const expiresAt = new Date(
      createdAt.getTime() +
        (userId ? SESSION_LIFETIME_MS : ANONYMOUS_LIFETIME_MS),
    );
    return {
      raw,
      csrf: csrfToken(raw),
      data: {
        tokenHash: tokenHash(raw),
        csrfTokenHash: tokenHash(csrfToken(raw)),
        userId,
        createdAt,
        expiresAt,
      },
    };
  }
  async function findSession(raw: string | undefined) {
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const session = await db.session.findUnique({
      where: { tokenHash: tokenHash(raw) },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!session) return null;
    if (session.expiresAt <= now()) {
      await db.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    return session;
  }
  return {
    findSession,
    async bootstrap() {
      await db.session.deleteMany({ where: { expiresAt: { lte: now() } } });
      const issued = sessionData(null);
      await db.session.create({ data: issued.data });
      return issued;
    },
    async login(sessionId: string, input: LoginInput) {
      if (activeVerifications >= 2)
        throw new HttpError(
          429,
          'RATE_LIMITED',
          'Sign-in is busy. Try again shortly.',
        );
      activeVerifications++;
      try {
        const user = await db.hrUser.findUnique({
          where: { email: input.email },
        });
        const valid = await verifyPassword(input.password, user?.passwordHash);
        if (!valid || !user)
          throw new HttpError(
            401,
            'INVALID_CREDENTIALS',
            'Email or password is incorrect.',
          );
        const issued = sessionData(user.id);
        await db.$transaction(async (tx) => {
          const removed = await tx.session.deleteMany({
            where: { id: sessionId, expiresAt: { gt: now() } },
          });
          if (removed.count !== 1)
            throw new HttpError(
              403,
              'CSRF_INVALID',
              'Your sign-in session has changed. Please try again.',
            );
          await tx.session.create({ data: issued.data });
        });
        return {
          ...issued,
          user: { id: user.id, email: user.email, role: 'HR_MANAGER' as const },
        };
      } finally {
        activeVerifications--;
      }
    },
    async logout(sessionId: string) {
      await db.session.deleteMany({ where: { id: sessionId } });
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
export type AuthSession = Awaited<ReturnType<AuthService['findSession']>>;
