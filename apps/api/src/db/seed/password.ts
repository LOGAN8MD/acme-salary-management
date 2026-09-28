import { randomBytes, scrypt } from 'node:crypto';

/** Self-describing format for the demo account; verification belongs to Task 5. */
export async function hashSeedPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error(
      'SEED_HR_PASSWORD must contain between 12 and 128 characters.',
    );
  }
  const salt = randomBytes(16);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
  return `scrypt$131072$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
