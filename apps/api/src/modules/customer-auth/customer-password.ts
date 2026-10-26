import { BadRequestException, HttpException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = 'scrypt$1$32768$8$3$';
const encoded = /^scrypt\$1\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/u;
// A non-account reference, used only to give absent identities the same KDF work.
export const DUMMY_PASSWORD_HASH = prefix + '0'.repeat(32) + '$' + '0'.repeat(128);
let activeDerivations = 0;

export function assertPasswordInput(password: string): void {
  if (typeof password !== 'string' || password.length < 1) {
    throw new BadRequestException({ code: 'INVALID_PASSWORD' });
  }
}
export function assertNewPassword(password: string): void {
  assertPasswordInput(password);
  if ([...password].length < 6) {
    throw new BadRequestException({ code: 'WEAK_PASSWORD' });
  }
}
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeDerivations >= 2) throw new HttpException({ code: 'HASH_BUSY', retryAfterSeconds: 1 }, 429);
  activeDerivations++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, parameters, (error, key) => error ? reject(error) : resolve(key));
    });
  } finally { activeDerivations--; }
}
export async function hashCustomerPassword(password: string): Promise<string> {
  assertNewPassword(password);
  const salt = randomBytes(16);
  return prefix + salt.toString('hex') + '$' + (await derive(password, salt)).toString('hex');
}
export async function verifyCustomerPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  assertPasswordInput(password);
  const actual = stored?.match(encoded);
  const reference = actual ?? DUMMY_PASSWORD_HASH.match(encoded)!;
  const key = await derive(password, Buffer.from(reference[1]!, 'hex'));
  return timingSafeEqual(key, Buffer.from(reference[2]!, 'hex')) && Boolean(actual);
}
