/** @type {import('next').NextConfig} */

const nextConfig = {
  output: "export",
  trailingSlash: true,
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;