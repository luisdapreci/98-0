import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '98-0. Basketball Across Generations',
    short_name: '98-0',
    description: 'Six picks. Seven decades. Build your all-time NBA lineup.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#131614',
    theme_color: '#131614',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}