import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'media-3.api-sports.io' },
      { protocol: 'https', hostname: 'media-4.api-sports.io' },
    ],
  },
  // Required for ExcelJS on server side
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
