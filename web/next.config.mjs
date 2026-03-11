import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async redirects() {
    return [
      { source: '/tickets', destination: '/passes', permanent: true },
      { source: '/tickets/find', destination: '/passes/find', permanent: true },
      { source: '/tickets/:gameId', destination: '/passes/:gameId', permanent: true },
    ];
  },
};

export default withPWA(nextConfig);
