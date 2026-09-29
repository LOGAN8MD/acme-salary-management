import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const mode = process.argv[2];
if (!['e2e', 'performance'].includes(mode))
  throw new Error('Use e2e or performance mode.');
const root = resolve(import.meta.dirname, '..');
const databaseDirectory = await mkdtemp(join(tmpdir(), 'acme-quality-db-'));
const children = [];

async function availablePort() {
  const server = createServer();
  await new Promise((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePort);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Unable to reserve a local test port.');
  await new Promise((resolveClose) => server.close(resolveClose));
  return address.port;
}

function run(file, args, env, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: root,
      env,
      stdio: 'inherit',
      ...options,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0
        ? resolveRun()
        : reject(
            new Error(
              `${file} exited with ${code ?? `signal ${String(signal)}`}`,
            ),
          ),
    );
  });
}

async function waitFor(url, child, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`${label} exited before it became ready.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Startup races are expected; retry until the bounded deadline.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`${label} did not become ready within 30 seconds.`);
}

function start(file, args, env) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  children.push(child);
  return child;
}

const [databasePort, apiPort, webPort] = await Promise.all([
  availablePort(),
  availablePort(),
  availablePort(),
]);
const databaseName = 'acme_quality';
const database = new EmbeddedPostgres({
  databaseDir: databaseDirectory,
  user: 'acme',
  password: 'acme_quality_only',
  port: databasePort,
  persistent: false,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', databaseDirectory],
  onLog: () => {},
  onError: () => {},
});
const databaseUrl = `postgresql://acme:acme_quality_only@127.0.0.1:${databasePort}/${databaseName}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  ACME_DISPOSABLE_DATABASE: databaseUrl,
  SEED_HR_PASSWORD: 'AcmeQualityTest2026!',
  PORT: String(apiPort),
  HOST: '127.0.0.1',
  APP_ORIGIN: webOrigin,
  API_PROXY_TARGET: apiOrigin,
  E2E_BASE_URL: webOrigin,
};
let databaseStarted = false;
try {
  await database.initialise();
  await database.start();
  databaseStarted = true;
  await database.createDatabase(databaseName);
  await run('node_modules/prisma/build/index.js', ['migrate', 'deploy'], env);
  await run('node_modules/tsx/dist/cli.mjs', ['prisma/seed.ts'], env);

  const api = start(
    'node_modules/tsx/dist/cli.mjs',
    ['apps/api/src/server.ts'],
    env,
  );
  const web = start(
    'node_modules/vite/bin/vite.js',
    [
      'apps/web',
      '--host',
      '127.0.0.1',
      '--port',
      String(webPort),
      '--strictPort',
    ],
    env,
  );
  await Promise.all([
    waitFor(`${apiOrigin}/api/v1/status`, api, 'API'),
    waitFor(webOrigin, web, 'web application'),
  ]);
  if (mode === 'e2e')
    await run(
      'node_modules/@playwright/test/cli.js',
      ['test', '--config', 'playwright.config.ts'],
      env,
    );
  else await run('scripts/performance.mjs', [], env);
} finally {
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolveExit) => {
          if (child.exitCode !== null) resolveExit();
          else child.once('exit', resolveExit);
        }),
    ),
  );
  if (databaseStarted) await database.stop();
  await rm(databaseDirectory, { recursive: true, force: true });
}
