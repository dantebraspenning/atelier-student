import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Native / WASM packages stay outside the bundle and are loaded by Node at runtime.
  serverExternalPackages: ['@electric-sql/pglite', 'sharp', 'postgres'],
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' }
    }
  },
  experimental: {
    serverActions: { bodySizeLimit: '1mb' }
  },
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/icon-192.png', permanent: true }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

export default withNextIntl(nextConfig);
