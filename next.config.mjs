/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keeps production builds inside a small (2 GB) container: Next otherwise
  // spawns one static-generation worker per reported CPU core.
  experimental: {
    cpus: Number(process.env.NEXT_BUILD_CPUS || 1),
    workerThreads: false,
  },
};

export default nextConfig;
