import type { Metadata } from "next";
import { PaginaLegalCorporativa } from "@/components/web/corporativa/PaginaLegalCorporativa";
import { enDominioPublico } from "@/lib/web/en-dominio";
import { bloquesPoliticaPrivacidad, FECHA_LEGAL } from "@/lib/web/corporativa/legal";
import { metadataCorporativa, tituloConMarca } from "@/lib/web/corporativa/metadata-seo";

export async function generateMetadata(): Promise<Metadata> {
  return metadataCorporativa({
    title: tituloConMarca("Política de privacidad"),
    description: "Información sobre el tratamiento de datos personales en REHABINCO, intermediación inmobiliaria y reformas.",
    path: "/politica-privacidad",
  });
}

export default async function PoliticaPrivacidadPage() {
  const enDominio = await enDominioPublico();
  return (
    <PaginaLegalCorporativa
      enDominio={enDominio}
      titulo="Política de privacidad"
      subtitulo={`Última actualización: ${FECHA_LEGAL}`}
      bloques={bloquesPoliticaPrivacidad()}
    />
  );
}
