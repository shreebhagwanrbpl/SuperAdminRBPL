/** @type {import('next').NextConfig} */

const nextConfig = {
  trailingSlash: true,
  serverExternalPackages: ["playwright", "playwright-core"],
  async rewrites() {
    const vpsUrl = String(process.env.NEXT_PUBLIC_ADMIN_API_URL || "")
      .trim()
      .replace(/\/+$/, "");

    if (!vpsUrl) return [];

    return [
      {
        source: "/api/:path*/",
        destination: `${vpsUrl}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${vpsUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*/",
        destination: `${vpsUrl}/uploads/:path*/`,
      },
      {
        source: "/uploads/:path*",
        destination: `${vpsUrl}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;