import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('API foundation', () => {
  it('exposes liveness without claiming database readiness', async () => {
    const response = await request(createApp()).get('/api/v1/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'running' } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('does not advertise an unimplemented salary API', async () => {
    const response = await request(createApp()).get('/api/v1/employees');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
