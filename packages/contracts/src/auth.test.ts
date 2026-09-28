import { describe, expect, it } from 'vitest';
import { loginInputSchema } from './index.js';
describe('login input contract', () => {
  it('normalizes email without altering password whitespace', () => {
    expect(
      loginInputSchema.parse({
        email: ' HR@EXAMPLE.TEST ',
        password: ' secret ',
      }),
    ).toEqual({ email: 'hr@example.test', password: ' secret ' });
  });
  it.each([
    { email: 'invalid', password: 'valid' },
    { email: 'hr@example.test', password: '' },
    { email: 'hr@example.test', password: 'x'.repeat(129) },
    { email: 'hr@example.test', password: 'valid', role: 'ADMIN' },
  ])('rejects invalid input or extra fields', (input) => {
    expect(loginInputSchema.safeParse(input).success).toBe(false);
  });
});
