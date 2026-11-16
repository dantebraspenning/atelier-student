import 'server-only';
import { headers } from 'next/headers';

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
export const bool = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true' || fd.get(key) === '1';
export const list = (fd: FormData, key: string) => fd.getAll(key).map(String).filter(Boolean);
export const localeOf = (fd: FormData): 'nl' | 'en' => (fd.get('locale') === 'en' ? 'en' : 'nl');

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(next: string | null | undefined, locale: string, fallback: string) {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next.startsWith(`/${locale}`) ? next : `/${locale}${next}`;
  return `/${locale}${fallback}`;
}
