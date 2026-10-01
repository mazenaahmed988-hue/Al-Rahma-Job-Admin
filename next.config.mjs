/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
