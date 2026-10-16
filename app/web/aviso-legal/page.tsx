import type { Metadata } from "next";
import { PaginaLegalCorporativa } from "@/components/web/corporativa/PaginaLegalCorporativa";
import { enDominioPublico } from "@/lib/web/en-dominio";
import { bloquesAvisoLegal, FECHA_LEGAL } from "@/lib/web/corporativa/legal";

export const metadata: Metadata = {
  title: "Aviso legal · Rehabinco",
  description: "Información legal del sitio web de Rehabinco.",
  robots: { index: true, follow: true },
};

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
