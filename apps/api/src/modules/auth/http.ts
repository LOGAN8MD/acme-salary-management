import { Router, type RequestHandler, type Response } from 'express';
import { parse } from 'cookie';
import { timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { loginInputSchema } from '@acme/contracts';
import { HttpError } from '../../middleware/errors.js';
import {
  csrfToken,
  tokenHash,
  type AuthService,
  type AuthSession,
} from './service.js';

export interface AuthConfig {
  origin: string;
  secureCookies: boolean;
}
interface Context {
  session: AuthSession;
  raw: string | undefined;
}
const context = (response: Response) => response.locals.auth as Context;
export function createAuthHttp(service: AuthService, config: AuthConfig) {
  const cookieName = config.secureCookies
    ? '__Host-acme-session'
    : 'acme-session';
  const cookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax' as const,
    path: '/',
  };
  const loadSession: RequestHandler = async (request, response, next) => {
    const raw = parse(request.headers.cookie ?? '')[cookieName];
    response.locals.auth = {
      raw,
      session: await service.findSession(raw),
    } satisfies Context;
    next();
  };
  const requireUser: RequestHandler = (_request, response, next) => {
    if (!context(response).session?.user)
      throw new HttpError(
        401,
        'UNAUTHENTICATED',
        'Please sign in to continue.',
      );
    next();
  };
  const requireCsrf: RequestHandler = (request, response, next) => {
    const provided = request.get('X-CSRF-Token');
    const session = context(response).session;
    if (
      request.get('Origin') !== config.origin ||
      !session ||
      !provided ||
      !/^[a-f0-9]{64}$/.test(provided) ||
      !timingSafeEqual(
        Buffer.from(tokenHash(provided), 'hex'),
        Buffer.from(session.csrfTokenHash, 'hex'),
      )
    ) {
      throw new HttpError(
        403,
        'CSRF_INVALID',
        'Your session could not be verified. Please try again.',
      );
    }
    next();
  };
  function limit(windowMs: number, count: number) {
    return rateLimit({
      windowMs,
      limit: count,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_request, response) => {
        response.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please try again later.',
            requestId: response.locals.requestId,
          },
        });
      },
    });
  }
  const router = Router();
  router.get(
    '/csrf',
    limit(60_000, 60),
    (request, _response, next) => {
      if (
        request.get('Sec-Fetch-Site') === 'cross-site' ||
        (request.get('Origin') && request.get('Origin') !== config.origin)
      ) {
        throw new HttpError(
          403,
          'CSRF_INVALID',
          'Request origin is not allowed.',
        );
      }
      next();
    },
    loadSession,
    async (_request, response) => {
      const { session, raw } = context(response);
      if (session && raw) {
        response.json({ data: { csrfToken: csrfToken(raw) } });
        return;
      }
      const issued = await service.bootstrap();
      response.cookie(cookieName, issued.raw, {
        ...cookieOptions,
        expires: issued.data.expiresAt,
      });
      response.json({ data: { csrfToken: issued.csrf } });
    },
  );
  router.post(
    '/login',
    limit(15 * 60_000, 10),
    loadSession,
    requireCsrf,
    async (request, response) => {
      const parsed = loginInputSchema.safeParse(request.body);
      if (!parsed.success)
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'Enter a valid email and password (maximum 128 characters).',
        );
      try {
        const result = await service.login(
          context(response).session!.id,
          parsed.data,
        );
        response.cookie(cookieName, result.raw, {
          ...cookieOptions,
          expires: result.data.expiresAt,
        });
        response.json({ data: { user: result.user, csrfToken: result.csrf } });
      } catch (error) {
        if (error instanceof HttpError && error.status === 429)
          response.set('Retry-After', '1');
        throw error;
      }
    },
  );
  router.get('/me', loadSession, requireUser, (_request, response) => {
    const user = context(response).session!.user!;
    response.json({
      data: { user: { id: user.id, email: user.email, role: 'HR_MANAGER' } },
    });
  });
  router.post(
    '/logout',
    loadSession,
    requireUser,
    requireCsrf,
    async (_request, response) => {
      await service.logout(context(response).session!.id);
      response.clearCookie(cookieName, cookieOptions).status(204).end();
    },
  );
  const protectMutation: RequestHandler = (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }
    requireCsrf(request, response, next);
  };
  return { router, loadSession, requireUser, protectMutation };
}
