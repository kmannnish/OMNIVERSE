/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@media-suite/shared'],
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
