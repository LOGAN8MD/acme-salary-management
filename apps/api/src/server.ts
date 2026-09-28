import { createApp } from './app.js';
import { createDatabaseClient } from './db/client.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer between 1 and 65535.');
const host = process.env.HOST ?? '127.0.0.1';
const secureCookies = process.env.NODE_ENV === 'production';
const origin =
  process.env.APP_ORIGIN ?? (secureCookies ? '' : 'http://127.0.0.1:5173');
const url = new URL(origin);
if (
  url.origin !== origin ||
  !['http:', 'https:'].includes(url.protocol) ||
  (secureCookies && url.protocol !== 'https:')
) {
  throw new Error(
    'APP_ORIGIN must be an exact origin; production requires HTTPS.',
  );
}
const db = createDatabaseClient();
await db.$connect();
const server = createApp({ db, auth: { origin, secureCookies } }).listen(
  port,
  host,
  () => {
    console.info(`API listening on http://${host}:${port}`);
  },
);
server.on('error', async (error) => {
  console.error('API failed to start:', error.message);
  await db.$disconnect();
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
