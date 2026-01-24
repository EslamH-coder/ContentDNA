/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Fix for @supabase/ssr module resolution
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@supabase/ssr/dist/index.mjs': '@supabase/ssr/dist/module/index.js',
      };
    }
    return config;
  },
}

module.exports = nextConfig

