import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/*/studio', '/*/admin', '/*/account', '/*/messages', '/*/requests', '/*/dev'] }],
    sitemap: `${env().APP_URL}/sitemap.xml`
  };
}
