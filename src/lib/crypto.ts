import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env, isProduction } from '@/lib/env';

function key(): Buffer {
  const raw = env().ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return k;
  }
  if (isProduction()) throw new Error('ENCRYPTION_KEY is required in production');
  return createHash('sha256').update('atelier-development-only-key').digest();
}

/** AES-256-GCM. Output: base64(iv).base64(tag).base64(ciphertext) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
