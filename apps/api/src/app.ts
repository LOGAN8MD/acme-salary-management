import express from 'express';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client.js';
import { createAuthService } from './modules/auth/service.js';
import { createAuthHttp, type AuthConfig } from './modules/auth/http.js';
import { errorHandler } from './middleware/errors.js';
import { createEmployeeService } from './modules/employees/service.js';
import { createEmployeeRouter } from './modules/employees/http.js';

export function createApp(options?: {
  db: PrismaClient;
  auth: AuthConfig;
  now?: () => Date;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID();
    response.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': response.locals.requestId,
    });
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/v1/status', (_request, response) =>
    response.json({ data: { status: 'running' } }),
  );
  if (options) {
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
      createEmployeeRouter(createEmployeeService(options.db)),
    );
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
