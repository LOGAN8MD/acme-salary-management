import { performance } from 'node:perf_hooks';
import { arch, cpus, platform, release } from 'node:os';

const baseUrl = process.env.E2E_BASE_URL;
if (!baseUrl) throw new Error('E2E_BASE_URL is required.');

function cookieFrom(response) {
  const value = response.headers.getSetCookie()[0];
  if (!value) throw new Error('Authentication response did not set a cookie.');
  return value.split(';', 1)[0];
}

const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
if (!csrfResponse.ok) throw new Error('CSRF bootstrap failed.');
let cookie = cookieFrom(csrfResponse);
const csrfBody = await csrfResponse.json();
const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: cookie,
    Origin: baseUrl,
    'X-CSRF-Token': csrfBody.data.csrfToken,
  },
  body: JSON.stringify({
    email: 'hr@acme.example.test',
    password: 'AcmeQualityTest2026!',
  }),
});
if (!login.ok) throw new Error('Benchmark login failed.');
cookie = cookieFrom(login);

async function timedRequest(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookie },
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
  const body = await response.json();
  return { milliseconds: performance.now() - started, body };
}

const employeeLookup = await timedRequest(
  '/api/v1/employees?search=ACME-000001',
);
const employeeId = employeeLookup.body.data[0]?.id;
if (!employeeId) throw new Error('Benchmark employee was not found.');
const cases = [
  ['directory', '/api/v1/employees?page=1&pageSize=25'],
  ['detail', `/api/v1/employees/${employeeId}`],
  ['report', '/api/v1/reports/salaries?currencyCode=INR&groupBy=department'],
];
const concurrency = 5;
const batches = 10;
const percentile = (values, fraction) =>
  values[Math.ceil(values.length * fraction) - 1];
const measurements = {};

for (const [name, path] of cases) {
  await Promise.all(
    Array.from({ length: concurrency }, () => timedRequest(path)),
  );
  const samples = [];
  for (let batch = 0; batch < batches; batch++) {
    const results = await Promise.all(
      Array.from({ length: concurrency }, () => timedRequest(path)),
    );
    samples.push(...results.map((result) => result.milliseconds));
  }
  samples.sort((left, right) => left - right);
  measurements[name] = {
    samples: samples.length,
    p50Ms: Number(percentile(samples, 0.5).toFixed(2)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(2)),
    maxMs: Number(samples.at(-1).toFixed(2)),
  };
}

console.info(
  JSON.stringify(
    {
      environment: {
        platform: `${platform()} ${release()} ${arch()}`,
        cpu: cpus()[0]?.model ?? 'unknown',
        logicalCpuCount: cpus().length,
        node: process.version,
        database: 'temporary local PostgreSQL',
        transport: 'localhost HTTP through Vite proxy',
      },
      dataset: { employees: 10_000, salaryChanges: 25_000 },
      load: { concurrency, measuredRequestsPerCase: concurrency * batches },
      measurements,
      provisionalTarget: 'p95 below 1000ms',
    },
    null,
    2,
  ),
);
