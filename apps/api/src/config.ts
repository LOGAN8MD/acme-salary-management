import { fileURLToPath } from 'node:url';

const productionWebDistPath = fileURLToPath(
  new URL('../../web/dist', import.meta.url),
);

function integer(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  return parsed;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = integer(env.PORT, 3001, 'PORT', 1, 65_535);
  const trustProxyHops = integer(
    env.TRUST_PROXY_HOPS,
    0,
    'TRUST_PROXY_HOPS',
    0,
    10,
  );
  const origin = env.APP_ORIGIN ?? (production ? '' : 'http://127.0.0.1:5173');
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('APP_ORIGIN must be an exact HTTP or HTTPS origin.');
  }
  if (
    url.origin !== origin ||
    !['http:', 'https:'].includes(url.protocol) ||
    (production && url.protocol !== 'https:')
  )
    throw new Error(
      'APP_ORIGIN must be an exact origin; production requires HTTPS.',
    );
  return {
    port,
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    origin,
    secureCookies: production,
    trustProxyHops,
    ...(production ? { webDistPath: productionWebDistPath } : {}),
  };
}
