import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
