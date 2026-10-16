import type { NextConfig } from "next";

const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const nextConfig: NextConfig = {
  transpilePackages: ["maplibre-gl"],
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/avm/valuations/[id]/pdf": [
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/sRGB_IEC61966_2_1.icc",
      "./public/images/logo-web.png",
      "./public/images/facturas/rehabinco-blanco.png",
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    const permisosContactos = [{ key: "Permissions-Policy", value: "contacts=(self)" }];
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
        headers: permisosContactos,
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
  async redirects() {
    const hostsCrm = ["crm.rehabinco.es", "localhost", "127.0.0.1"];
    const alCrm = hostsCrm.flatMap((host) => {
      const has = [{ type: "host" as const, value: host }];
      return [
        { source: "/inmuebles", destination: "/propiedades", permanent: false, has },
        { source: "/inmuebles/:path*", destination: "/propiedades/:path*", permanent: false, has },
      ];
    });
    return [
      ...alCrm,
      { source: "/visitas", destination: "/partes-visita", permanent: false },
      { source: "/visitas/:path*", destination: "/partes-visita/:path*", permanent: false },
      { source: "/follow-up", destination: "/seguimiento", permanent: false },
    ];
  },
};

export default nextConfig;
