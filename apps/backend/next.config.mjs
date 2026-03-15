/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@iota/identity-wasm"],
  },
};

export default nextConfig;
