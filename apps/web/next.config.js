/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@liveclaw/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.b-cdn.net' },
      { protocol: 'https', hostname: 'liveclaw.tv' },
      { protocol: 'https', hostname: 'api.liveclaw.tv' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'files.catbox.moe' },
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: 'ibb.co' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.liveclaw.tv' }],
        destination: 'https://liveclaw.tv/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const hlsOrigin = process.env.HLS_ORIGIN || 'http://165.227.91.241:8888';
    const thumbOrigin = process.env.THUMBNAIL_ORIGIN || 'http://165.227.91.241:8889';
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/hls/:path*',
        destination: `${hlsOrigin}/:path*`,
      },
      {
        source: '/thumbnails/:path*',
        destination: `${thumbOrigin}/:path*`,
      },
      {
        source: '/clips-media/:path*',
        destination: `${apiOrigin}/clips-media/:path*`,
      },
    ];
  },
  async headers() {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').trim();
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001').trim();
    const hlsUrl = (process.env.NEXT_PUBLIC_HLS_URL || 'http://localhost:8888').trim();
    return [
      {
        // HTML pages: never cache — hard refresh always gets fresh content
        source: '/((?!_next/static|_next/image|favicon|logo|clips-media).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.b-cdn.net https://pbs.twimg.com https://files.catbox.moe https://i.pinimg.com https://ibb.co https://i.ibb.co",
              "font-src 'self'",
              `connect-src 'self' ${apiUrl} ${wsUrl} wss://${new URL(wsUrl).host} https://api.coingecko.com https://*.b-cdn.net`,
              `media-src 'self' blob: ${hlsUrl} https://*.b-cdn.net`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
