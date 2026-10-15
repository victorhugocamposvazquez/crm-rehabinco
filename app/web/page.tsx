import type { Metadata } from "next";
import { SitioPublico } from "@/components/web/SitioPublico";
import { cargarWebPublica } from "@/lib/web/cargar";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const web = await cargarWebPublica();
  const nombre = web?.sitio.marca.nombre ?? "Rehabinco";
  return {
    title: nombre,
    description: "Inmuebles de la agencia",
    robots: web?.sitio.publicado ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function WebPublicaPage() {
  const web = await cargarWebPublica();
  if (!web) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F6F4EF] px-6 text-[#1A1A1A]">
        <p className="max-w-md text-center text-lg">La web no está disponible.</p>
      </main>
    );
  }
  return <SitioPublico web={web} />;
}
