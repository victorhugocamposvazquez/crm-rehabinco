import type { Metadata } from "next";
import { PaginaLegalCorporativa } from "@/components/web/corporativa/PaginaLegalCorporativa";
import { enDominioPublico } from "@/lib/web/en-dominio";
import { bloquesAvisoLegal, FECHA_LEGAL } from "@/lib/web/corporativa/legal";
import { metadataCorporativa, tituloConMarca } from "@/lib/web/corporativa/metadata-seo";

export async function generateMetadata(): Promise<Metadata> {
  return metadataCorporativa({
    title: tituloConMarca("Aviso legal"),
    description: "Información legal del sitio web de REHABINCO Gestión Inmobiliaria y Reformas.",
    path: "/aviso-legal",
  });
}

export default async function AvisoLegalPage() {
  const enDominio = await enDominioPublico();
  return (
    <PaginaLegalCorporativa
      enDominio={enDominio}
      titulo="Aviso legal"
      subtitulo={`Última actualización: ${FECHA_LEGAL}`}
      bloques={bloquesAvisoLegal()}
    />
  );
}
