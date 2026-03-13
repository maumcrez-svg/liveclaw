/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@liveclaw/shared'],
  async rewrites() {
    const hlsOrigin = process.env.HLS_ORIGIN || 'http://165.227.91.241:8888';
    return [
      {
        source: '/hls/:path*',
        destination: `${hlsOrigin}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
