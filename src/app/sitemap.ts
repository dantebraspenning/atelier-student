import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { listMakers } from '@/lib/domain/students';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().APP_URL;
  const pages = ['', '/makers', '/request', '/sign-up?role=student', '/legal/terms', '/legal/privacy'];
  const makers = await listMakers().catch(() => []);
  const entry = (path: string) => ({ url: `${base}/nl${path}`, alternates: { languages: { nl: `${base}/nl${path}`, en: `${base}/en${path}` } } });
  return [...pages.map(entry), ...makers.map((m) => ({ ...entry(`/makers/${m.slug}`), changeFrequency: 'weekly' as const }))];
}
