import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // www로 들어오면 대표 도메인으로 영구 이동 (색인 중복 방지)
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ggpli.com" }],
        destination: "https://ggpli.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
