/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // O service worker nunca deve ficar em cache, senão as atualizações do app não chegam
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
};
export default nextConfig;
