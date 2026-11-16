import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atelier Student',
    short_name: 'Atelier',
    description: 'Made-to-measure clothing by fashion students',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F3EC',
    theme_color: '#F6F3EC',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
