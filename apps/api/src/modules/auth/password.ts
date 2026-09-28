import { scrypt, timingSafeEqual } from 'node:crypto';

const DUMMY = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
/** Pin supported parameters so a malformed stored hash cannot request arbitrary work. */
export async function verifyPassword(
  password: string,
  encoded: string | undefined,
) {
  const valid = /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(
    encoded ?? '',
  );
  const fields = (valid ? encoded! : DUMMY).split('$');
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(fields[4]!, 'hex'),
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
  return timingSafeEqual(actual, Buffer.from(fields[5]!, 'hex')) && valid;
}
