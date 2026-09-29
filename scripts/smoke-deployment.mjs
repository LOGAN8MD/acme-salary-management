const rawUrl = process.env.DEPLOYMENT_URL;
if (!rawUrl) throw new Error('DEPLOYMENT_URL is required.');
const deploymentUrl = new URL(rawUrl);
if (!['http:', 'https:'].includes(deploymentUrl.protocol))
  throw new Error('DEPLOYMENT_URL must use HTTP or HTTPS.');
const baseUrl = deploymentUrl.origin;
const requestOrigin = process.env.DEPLOYMENT_ORIGIN ?? baseUrl;
const email = process.env.DEPLOYMENT_SMOKE_EMAIL ?? 'hr@acme.example.test';
const password =
  process.env.DEPLOYMENT_SMOKE_PASSWORD ?? process.env.SEED_HR_PASSWORD;
if (!password)
  throw new Error('DEPLOYMENT_SMOKE_PASSWORD or SEED_HR_PASSWORD is required.');

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok)
    throw new Error(`${path} returned unexpected status ${response.status}.`);
  return response;
}
function cookieFrom(response) {
  const value = response.headers.getSetCookie()[0];
  if (!value) throw new Error('Expected the server to issue a session cookie.');
  return value.split(';', 1)[0];
}

const status = await request('/api/v1/status');
if ((await status.json()).data?.status !== 'running')
  throw new Error('Liveness response was invalid.');
const health = await request('/api/v1/health');
if ((await health.json()).data?.status !== 'ready')
  throw new Error('Readiness response was invalid.');
const index = await request('/');
const html = await index.text();
if (!html.includes('<div id="root"></div>'))
  throw new Error('Production HTML shell was not served.');
const assetPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
if (!assetPath) throw new Error('Production JavaScript asset was not linked.');
const asset = await request(assetPath);
if (!asset.headers.get('cache-control')?.includes('immutable'))
  throw new Error('Hashed production asset was not immutable.');

const csrfResponse = await request('/api/v1/auth/csrf');
let cookie = cookieFrom(csrfResponse);
const csrf = (await csrfResponse.json()).data?.csrfToken;
if (!csrf) throw new Error('CSRF bootstrap response was invalid.');
const login = await request('/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: cookie,
    Origin: requestOrigin,
    'X-CSRF-Token': csrf,
  },
  body: JSON.stringify({ email, password }),
});
cookie = cookieFrom(login);
const loginBody = await login.json();
if (loginBody.data?.user?.email !== email)
  throw new Error('Deployment login response was invalid.');
const authenticated = { headers: { Cookie: cookie } };
const directory = await request(
  '/api/v1/employees?search=ACME-000001',
  authenticated,
);
if ((await directory.json()).pagination?.totalItems !== 1)
  throw new Error('Seeded employee smoke lookup failed.');
const report = await request(
  '/api/v1/reports/salaries?currencyCode=INR&groupBy=department',
  authenticated,
);
if ((await report.json()).data?.summary?.employeeCount !== 2000)
  throw new Error('Seeded salary report smoke check failed.');
const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
  method: 'POST',
  headers: {
    Cookie: cookie,
    Origin: requestOrigin,
    'X-CSRF-Token': loginBody.data.csrfToken,
  },
});
if (logout.status !== 204)
  throw new Error(`/api/v1/auth/logout returned ${logout.status}.`);
console.info('Deployment smoke test passed.');
