import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/inmuebles", destination: "/propiedades", permanent: false },
      { source: "/inmuebles/:path*", destination: "/propiedades/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
