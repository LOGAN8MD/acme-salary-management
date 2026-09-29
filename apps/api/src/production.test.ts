import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrismaClient } from './generated/prisma/client.js';
import { createApp } from './app.js';
import { readServerConfig } from './config.js';

let webDistPath: string;
beforeEach(async () => {
  webDistPath = await mkdtemp(join(tmpdir(), 'acme-web-dist-'));
  await mkdir(join(webDistPath, 'assets'));
  await writeFile(
    join(webDistPath, 'index.html'),
    '<!doctype html><title>ACME production</title><div id="root"></div>',
  );
  await writeFile(join(webDistPath, 'assets', 'app-hash.js'), 'export {};');
});
afterEach(async () => rm(webDistPath, { recursive: true, force: true }));

function database(query: ReturnType<typeof vi.fn>) {
  return { $queryRaw: query } as unknown as PrismaClient;
}
function productionApp(query = vi.fn().mockResolvedValue([{ '?column?': 1 }])) {
  return createApp({
    db: database(query),
    auth: { origin: 'https://salary.example.test', secureCookies: true },
    trustProxyHops: 1,
    webDistPath,
  });
}

describe('production application', () => {
  it('reports database readiness without exposing failures', async () => {
    const healthy = await request(productionApp()).get('/api/v1/health');
    expect(healthy.status).toBe(200);
    expect(healthy.body).toEqual({ data: { status: 'ready' } });
    expect(healthy.headers['strict-transport-security']).toContain(
      'max-age=31536000',
    );

    const unavailable = await request(
      productionApp(vi.fn().mockRejectedValue(new Error('secret database'))),
    ).get('/api/v1/health');
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(unavailable.text).not.toContain('secret database');
  });

  it('serves immutable assets and the SPA without masking API or file 404s', async () => {
    const app = productionApp();
    expect(app.get('trust proxy')).toBe(1);
    const asset = await request(app).get('/assets/app-hash.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    const route = await request(app).get('/employees/example');
    expect(route.status).toBe(200);
    expect(route.text).toContain('ACME production');
    expect((await request(app).get('/missing.js')).status).toBe(404);
    const api = await request(app).get('/api/v1/missing');
    expect(api.status).toBe(404);
    expect(api.body.error.code).toBe('NOT_FOUND');
  });
});

describe('server configuration', () => {
  it('uses explicit production network and proxy settings', () => {
    expect(
      readServerConfig({
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://salary.example.test',
        PORT: '10000',
        HOST: '0.0.0.0',
        TRUST_PROXY_HOPS: '1',
      }),
    ).toMatchObject({
      port: 10000,
      host: '0.0.0.0',
      origin: 'https://salary.example.test',
      secureCookies: true,
      trustProxyHops: 1,
    });
  });

  it('rejects unsafe or malformed production settings', () => {
    expect(() => readServerConfig({ NODE_ENV: 'production' })).toThrow(
      'APP_ORIGIN',
    );
    expect(() =>
      readServerConfig({
        NODE_ENV: 'production',
        APP_ORIGIN: 'http://salary.example.test',
      }),
    ).toThrow('production requires HTTPS');
    expect(() => readServerConfig({ TRUST_PROXY_HOPS: 'many' })).toThrow(
      'TRUST_PROXY_HOPS',
    );
  });
});
