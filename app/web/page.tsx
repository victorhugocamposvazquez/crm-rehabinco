import type { Metadata } from "next";
import { HomeCorporativa } from "@/components/web/corporativa/HomeCorporativa";
import { cargarCatalogoCorporativa } from "@/lib/web/corporativa/cargar";
import { enDominioPublico } from "@/lib/web/en-dominio";
import {
  DESCRIPCION_SITIO,
  metadataCorporativa,
  TITULO_SITIO,
} from "@/lib/web/corporativa/metadata-seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return metadataCorporativa({
    title: TITULO_SITIO,
    description: DESCRIPCION_SITIO,
    path: "/",
  });
}

export default async function WebPublicaPage() {
  const enDominio = await enDominioPublico();
  const { inmuebles, publicado } = await cargarCatalogoCorporativa();
  if (enDominio && !publicado) {
    return (
      <main className="corp-pad flex min-h-dvh items-center justify-center">
        <p className="max-w-md text-center text-lg">La web todavía no está publicada.</p>
      </main>
    );
  }
  return <HomeCorporativa inmuebles={inmuebles} enDominio={enDominio} />;
}
