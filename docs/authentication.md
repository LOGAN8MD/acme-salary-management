# HR authentication — Task 5

Implemented: login/logout, session restoration, PostgreSQL-backed sessions, shared input/response contracts, CSRF/origin protection, and an accessible login form. The signed-in screen is a milestone placeholder; navigation and business screens remain later tasks.

## Review locally

Use the same hostname throughout: **http://127.0.0.1:5173**. `APP_ORIGIN` must exactly match the browser origin. The `.env.example` uses that origin; copy it to `.env` only if `.env` does not already exist, or add the missing variables to your existing file.

```sh
npm run db:local
```

In another terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

The local database is already seeded in this workspace. Sign in as `hr@acme.example.test`, using the password configured when it was seeded. The example local-demo password is `AcmeLocalDemo2026!`; a rerun of the seed does not reset an existing password. The API now requires a reachable database at startup.

Review valid sign-in, an incorrect password, reload while signed in, and sign-out. The login form uses labeled fields, password-manager autocomplete, a disabled pending state, error alerts, and a session-loading retry action. Session identity is checked on page focus and every minute while signed in. Tokens are not stored in localStorage or sessionStorage. Successful login/logout updates the active auth query and removes other cached data.

## HTTP interface

| Endpoint                   | Behavior                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/csrf`    | Create a 20-minute anonymous session if needed and return its CSRF token; existing valid sessions keep a stable token                     |
| `POST /api/v1/auth/login`  | Validate strict email/password input, verify scrypt hash, revoke the prior session and issue a new authenticated session/token atomically |
| `GET /api/v1/auth/me`      | Return only ID, email, and HR_MANAGER role; return 401 for missing, invalid, anonymous, or expired sessions                               |
| `POST /api/v1/auth/logout` | Require authentication/CSRF, delete the session, clear the cookie, return 204                                                             |

All responses disable caching and use request IDs. Errors omit password hashes, tokens, stack traces, and database details. Unknown emails and wrong passwords receive the same message; unknown users still perform the same scrypt work. Unknown employee/report endpoints now return 401 when unauthenticated and 404 when authenticated because those handlers are not yet implemented. Future writes in those route groups are already guarded by CSRF middleware.

## Session and CSRF design

Session cookies contain a cryptographically random 32-byte opaque token. PostgreSQL stores its SHA-256 hash, never the bearer value. Authenticated sessions expire absolutely after eight hours, without sliding renewal. Expired sessions are denied and removed when encountered; bootstrap also removes expired rows. Successful login rotates both session and CSRF tokens. A revoked session cannot be restored after server restart because validity is stored in PostgreSQL.

The synchronizer CSRF token is HMAC-SHA256 over a fixed purpose string using the raw session token as the key. This keeps it stable across reloads/tabs without storing plaintext tokens. Its hash is stored with the session and checked using a timing-safe comparison. CSRF alone never authenticates a request. No JWT or server signing secret is needed for these opaque database-backed sessions.

Mutations require both `X-CSRF-Token` and an `Origin` exactly equal to `APP_ORIGIN`; missing origin is rejected. CSRF bootstrap rejects a foreign supplied Origin or `Sec-Fetch-Site: cross-site`. Same-origin GETs may omit Origin. No cross-origin CORS access is enabled.

Cookies use `HttpOnly`, `SameSite=Lax`, `Path=/`, and expiry. With `NODE_ENV=production`, cookies also use `Secure` and the `__Host-` prefix; production startup requires an HTTPS `APP_ORIGIN`. No Domain attribute is set. Local HTTP development uses the unprefixed cookie.

## Password and request limits

Password verification accepts only the seeded scrypt format and fixed work parameters, with a timing-safe derived-key comparison. Input is capped at 128 characters and request JSON at 16 KiB. Only the email is trimmed/lowercased; passwords are not altered.

Login is limited to 10 requests per IP per 15 minutes, including unsuccessful/invalid submissions. CSRF bootstrap is limited to 60 requests per IP per minute. At most two scrypt verifications run concurrently per application instance to bound memory pressure. Rate-limited responses include `Retry-After`.

Rate counters are in process memory and reset on restart. Proxy trust is intentionally disabled, so forwarded headers cannot spoof client IPs; an eventual trusted deployment proxy needs explicit configuration and possibly shared rate storage before scaling to multiple instances. This is a documented deployment constraint, not a claim of distributed throttling.

The design follows [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) and uses [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) for request limits.

## Verification and remaining scope

`npm run test:db` covers the real PostgreSQL auth lifecycle, rotation, hashed storage, restart persistence, expiry, generic credential failures, CSRF/origin rejection, production cookie flags, throttling, input errors, and protected route groups. `npm run check` covers shared contract validation, component interactions, existing unit/API tests, typing, lint, formatting, and builds. Manual browser checks verified login, reload restoration, and logout with the local demo account.

No registration, password reset, SSO, additional roles, readiness endpoint, dashboard navigation, or employee/salary/report functionality was added. The production build currently emits a chunk-size advisory; review code splitting with the broader frontend work.
