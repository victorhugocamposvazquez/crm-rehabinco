import type { NextConfig } from "next";

const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/inmuebles", destination: "/propiedades", permanent: false },
      { source: "/inmuebles/:path*", destination: "/propiedades/:path*", permanent: false },
      { source: "/visitas", destination: "/partes-visita", permanent: false },
      { source: "/visitas/:path*", destination: "/partes-visita/:path*", permanent: false },
      { source: "/follow-up", destination: "/seguimiento", permanent: false },
    ];
  },
};

export default nextConfig;
