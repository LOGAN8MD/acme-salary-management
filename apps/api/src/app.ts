import express from 'express';
import { randomUUID } from 'node:crypto';
import { extname, join, sep } from 'node:path';
import type { PrismaClient } from './generated/prisma/client.js';
import { createAuthService } from './modules/auth/service.js';
import { createAuthHttp, type AuthConfig } from './modules/auth/http.js';
import { errorHandler } from './middleware/errors.js';
import { createEmployeeService } from './modules/employees/service.js';
import { createEmployeeRouter } from './modules/employees/http.js';
import { createReportService } from './modules/reports/service.js';
import { createReportRouter } from './modules/reports/http.js';

export interface AppOptions {
  db: PrismaClient;
  auth: AuthConfig;
  now?: () => Date;
  trustProxyHops?: number;
  webDistPath?: string;
}

export function createApp(options?: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  if (options?.trustProxyHops) app.set('trust proxy', options.trustProxyHops);
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID();
    response.set({
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Request-Id': response.locals.requestId,
      ...(options?.auth.secureCookies && {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      }),
    });
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/v1/status', (_request, response) =>
    response.json({ data: { status: 'running' } }),
  );
  if (options) {
    app.get('/api/v1/health', async (_request, response) => {
      try {
        await options.db.$queryRaw`SELECT 1`;
        response.json({ data: { status: 'ready' } });
      } catch {
        response.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service is not ready.',
            requestId: response.locals.requestId,
          },
        });
      }
    });
    const auth = createAuthHttp(
      createAuthService(options.db, options.now),
      options.auth,
    );
    app.use('/api/v1/auth', auth.router);
    // Every future employee/report route is guarded before its handler is mounted.
    app.use(
      ['/api/v1/employees', '/api/v1/reports'],
      auth.loadSession,
      auth.requireUser,
      auth.protectMutation,
    );
    app.use(
      '/api/v1/employees',
      createEmployeeRouter(createEmployeeService(options.db, options.now)),
    );
    app.use(
      '/api/v1/reports',
      createReportRouter(createReportService(options.db)),
    );
    if (options.webDistPath) {
      app.use(
        express.static(options.webDistPath, {
          index: false,
          setHeaders: (response, filePath) => {
            response.setHeader(
              'Cache-Control',
              filePath.includes(`${sep}assets${sep}`)
                ? 'public, max-age=31536000, immutable'
                : 'no-store',
            );
          },
        }),
      );
      app.use((request, response, next) => {
        const apiPath =
          request.path === '/api' || request.path.startsWith('/api/');
        if (
          request.method === 'GET' &&
          !apiPath &&
          !extname(request.path) &&
          request.accepts('html')
        ) {
          response.sendFile(
            join(options.webDistPath!, 'index.html'),
            (error) => (error ? next(error) : undefined),
          );
          return;
        }
        next();
      });
    }
  }
  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
        requestId: response.locals.requestId,
      },
    });
  });
  app.use(errorHandler);
  return app;
}
