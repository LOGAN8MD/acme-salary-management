import { createApp } from './app.js';
import { createDatabaseClient } from './db/client.js';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { readServerConfig } from './config.js';

const config = readServerConfig();
if (config.webDistPath) await access(join(config.webDistPath, 'index.html'));
const db = createDatabaseClient();
await db.$connect();
const server = createApp({
  db,
  auth: { origin: config.origin, secureCookies: config.secureCookies },
  trustProxyHops: config.trustProxyHops,
  ...(config.webDistPath ? { webDistPath: config.webDistPath } : {}),
}).listen(config.port, config.host, () => {
  console.info(`Application listening on ${config.host}:${config.port}`);
});
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
