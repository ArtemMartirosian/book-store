import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return ["catalog", "cart", "account", "favorites", "search", "books/:slug"].map((path) => ({
      source: `/${path}`, destination: `/hy/${path}`, permanent: true,
    }));
  },
  async headers() {
    const privatePages = ["/admin/:path*", "/api/:path*", "/:locale/cart", "/:locale/account", "/:locale/favorites", "/:locale/search"];
    const headers = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];
    return [
      ...privatePages.map((source) => ({ source, headers })),
      ...(process.env.SITE_INDEXING_ENABLED === "true" ? [] : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]),
    ];
  },
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL;
    if (!backend) return [];

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
