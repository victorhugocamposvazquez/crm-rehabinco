import type { Metadata } from "next";
import { PaginaLegalCorporativa } from "@/components/web/corporativa/PaginaLegalCorporativa";
import { enDominioPublico } from "@/lib/web/en-dominio";
import { bloquesPoliticaCookies, FECHA_LEGAL } from "@/lib/web/corporativa/legal";
import { metadataCorporativa, tituloConMarca } from "@/lib/web/corporativa/metadata-seo";

export async function generateMetadata(): Promise<Metadata> {
  return metadataCorporativa({
    title: tituloConMarca("Política de cookies"),
    description: "Información sobre cookies y preferencias en la web de REHABINCO.",
    path: "/politica-cookies",
  });
}

export default async function PoliticaCookiesPage() {
  const enDominio = await enDominioPublico();
  return (
    <PaginaLegalCorporativa
      enDominio={enDominio}
      titulo="Política de cookies"
      subtitulo={`Última actualización: ${FECHA_LEGAL}`}
      bloques={bloquesPoliticaCookies()}
    />
  );
}
