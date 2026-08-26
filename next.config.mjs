/** @type {import('next').NextConfig} */

const nextConfig = {
  trailingSlash: true,
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;