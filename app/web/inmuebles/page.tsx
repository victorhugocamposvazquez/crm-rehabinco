import type { Metadata } from "next";
import { ListadoCorporativa } from "@/components/web/corporativa/ListadoCorporativa";
import { cargarCatalogoCorporativa } from "@/lib/web/corporativa/cargar";
import { enDominioPublico } from "@/lib/web/en-dominio";
import type { ModoCorporativa } from "@/lib/web/corporativa/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Inmuebles | Rehabinco",
    description: "Pisos y casas en venta y alquiler en A Coruña y alrededores.",
  };
}

export default async function InmueblesWebPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const params = await searchParams;
  const modo: ModoCorporativa = params.modo === "alquiler" ? "alquiler" : "venta";
  const enDominio = await enDominioPublico();
  const { inmuebles, publicado } = await cargarCatalogoCorporativa();
  if (enDominio && !publicado) {
    return (
      <main className="corp-pad flex min-h-dvh items-center justify-center">
        <p className="max-w-md text-center text-lg">La web todavía no está publicada.</p>
      </main>
    );
  }
  return <ListadoCorporativa inmuebles={inmuebles} enDominio={enDominio} modoInicial={modo} />;
}
