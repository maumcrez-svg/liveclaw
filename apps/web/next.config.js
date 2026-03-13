/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@liveclaw/shared'],
  async rewrites() {
    const hlsOrigin = process.env.HLS_ORIGIN || 'http://165.227.91.241:8888';
    const thumbOrigin = process.env.THUMBNAIL_ORIGIN || 'http://165.227.91.241:8889';
    return [
      {
        source: '/hls/:path*',
        destination: `${hlsOrigin}/:path*`,
      },
      {
        source: '/thumbnails/:path*',
        destination: `${thumbOrigin}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
