import { ParteVisitaFirmaForm } from "@/components/partes-visita/ParteVisitaFirmaForm";
import { getParteVisitaPublic } from "@/lib/actions/partes-visita";
import { EMPRESA_PARTE_VISITA } from "@/lib/partes-visita";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Parte de visita | ${EMPRESA_PARTE_VISITA.razonSocial}`,
  description: "Firma el parte de visita inmobiliaria",
  robots: { index: false, follow: false },
};

export default async function FirmarParteVisitaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getParteVisitaPublic(token);

  if (!result.success) {
    return (
      <main className="min-h-dvh bg-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">Enlace no válido</p>
          <p className="mt-2 text-sm text-neutral-600">{result.error}</p>
        </div>
      </main>
    );
  }

  if (result.parte.estado === "borrador") {
    return (
      <main className="min-h-dvh bg-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">
            Parte no disponible
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Este parte aún no está listo para firmar. Contacta con tu agente.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#f0fdfa_0%,#f5f5f5_35%,#f5f5f5_100%)] px-4 py-8 sm:py-12">
      <ParteVisitaFirmaForm parte={result.parte} />
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-neutral-400">
        {EMPRESA_PARTE_VISITA.razonSocial} · Documento de constancia de visita
      </p>
    </main>
  );
}
