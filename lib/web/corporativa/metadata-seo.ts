import type { Metadata } from "next";
import { headers } from "next/headers";
import { esHostCrm, hostDe } from "@/lib/web/dominio";

/** Igual que la web actual en rehabinco.com */
export const TITULO_SITIO = "REHABINCO Gestión Inmobiliaria y Reformas";
export const DESCRIPCION_SITIO = "REHABINCO Gestión Inmobiliaria y Reformas";

export const GOOGLE_SITE_VERIFICATION = "SXYCLdM0X1mYCXiEi9NIBKgpdPmJB8IEfdLTUklF69Q";

export const RUTA_OG_PORTADA = "/web/brand/og-portada.jpg";
export const RUTA_FAVICON = "/web/brand/favicon.ico";
export const RUTA_APPLE_ICON = "/web/brand/apple-touch-icon.png";

const DOMINIO_CANONICO = "https://rehabinco.com";

export async function metadataBaseWeb(): Promise<URL> {
  const h = await headers();
  const host = hostDe(h.get("x-forwarded-host") ?? h.get("host"));
  if (host && !esHostCrm(host)) return new URL(`https://${host}`);
  return new URL(DOMINIO_CANONICO);
}

type OpcionesMetadata = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
};

export async function metadataCorporativa(opciones: OpcionesMetadata = {}): Promise<Metadata> {
  const base = await metadataBaseWeb();
  const title = opciones.title ?? TITULO_SITIO;
  const description = opciones.description ?? DESCRIPCION_SITIO;
  const imagen = opciones.image ?? RUTA_OG_PORTADA;
  const imagenAbs = imagen.startsWith("http") ? imagen : new URL(imagen, base).toString();
  const path = opciones.path ?? "/";
  const url = new URL(path, base).toString();

  return {
    metadataBase: base,
    title,
    description,
    keywords: [
      "REHABINCO",
      "inmobiliaria",
      "reformas",
      "A Coruña",
      "gestión inmobiliaria",
      "comprar piso",
      "vender piso",
      "alquiler",
    ],
    applicationName: "REHABINCO",
    authors: [{ name: "REHABINCO" }],
    creator: "REHABINCO",
    publisher: "REHABINCO",
    formatDetection: { email: false, address: false, telephone: false },
    robots: opciones.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    alternates: { canonical: url },
    verification: {
      google: GOOGLE_SITE_VERIFICATION,
    },
    icons: {
      icon: [{ url: RUTA_FAVICON, type: "image/x-icon" }],
      shortcut: [RUTA_FAVICON],
      apple: [{ url: RUTA_APPLE_ICON, sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "es_ES",
      url,
      siteName: TITULO_SITIO,
      title,
      description,
      images: [
        {
          url: imagenAbs,
          width: 1024,
          height: 980,
          alt: opciones.imageAlt ?? "REHABINCO — Gestión Inmobiliaria y Reformas",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagenAbs],
    },
  };
}

export function tituloConMarca(fragmento: string): string {
  if (fragmento === TITULO_SITIO) return TITULO_SITIO;
  return `${fragmento} | REHABINCO`;
}
