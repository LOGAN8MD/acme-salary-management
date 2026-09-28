import express from 'express';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Liveness only. Database readiness is introduced with database integration.
  app.get('/api/v1/status', (_request, response) => {
    response
      .set('Cache-Control', 'no-store')
      .json({ data: { status: 'running' } });
  });
  app.use((_request, response) => {
    response
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
  return app;
}
