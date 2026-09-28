import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const testing = process.argv[2] === 'test';
if (!testing && process.argv[2] !== 'local')
  throw new Error('Use local or test mode.');
async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const directory = testing
  ? await mkdtemp(join(tmpdir(), 'acme-db-test-'))
  : resolve('.local/postgres');
const port = testing ? await availablePort() : 55432;
const database = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'acme',
  password: 'acme_local_only',
  port,
  persistent: !testing,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', directory],
  onLog: () => {},
  onError: () => {},
});
const databaseName = testing ? 'acme_test' : 'acme';
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://acme:acme_local_only@127.0.0.1:${port}/${databaseName}`,
};
if (testing) env.ACME_DISPOSABLE_DATABASE = env.DATABASE_URL;
function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`)),
    );
  });
}
let started = false;
try {
  await database.initialise();
  await database.start();
  started = true;
  const client = database.getPgClient();
  await client.connect();
  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (result.rowCount === 0) await database.createDatabase(databaseName);
  } finally {
    await client.end();
  }
  if (testing) {
    await run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
    // Repeat deploy to verify that committed migrations are safely reusable.
    await run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
    await run('node_modules/vitest/vitest.mjs', [
      'run',
      '--config',
      'vitest.database.config.ts',
    ]);
  } else {
    console.info(
      'Local PostgreSQL ready on 127.0.0.1:55432. Data persists in .local/postgres.',
    );
    console.info(
      'Use the DATABASE_URL in .env.example, then run npm run db:migrate. Ctrl+C stops the database.',
    );
    await new Promise((resolve) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  }
} finally {
  if (started) await database.stop();
  if (testing) await rm(directory, { recursive: true, force: true });
}
