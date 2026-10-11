import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Estação meteorológica',
    short_name: 'Estação',
    description: 'Temperatura, umidade, tempo e previsão da sua estação com ESP8266.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07101e',
    theme_color: '#07101e',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
