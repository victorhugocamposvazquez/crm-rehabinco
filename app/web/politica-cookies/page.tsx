import type { Metadata } from "next";
import { PaginaLegalCorporativa } from "@/components/web/corporativa/PaginaLegalCorporativa";
import { enDominioPublico } from "@/lib/web/en-dominio";
import { bloquesPoliticaCookies, FECHA_LEGAL } from "@/lib/web/corporativa/legal";

export const metadata: Metadata = {
  title: "Política de cookies · Rehabinco",
  description: "Información sobre cookies y preferencias en la web de Rehabinco.",
  robots: { index: true, follow: true },
};

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
