import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaPublica } from "@/components/web/FichaPublica";
import { cargarWebPublica } from "@/lib/web/cargar";
import { enDominioPublico } from "@/lib/web/en-dominio";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ referencia: string }>;
}): Promise<Metadata> {
  const { referencia } = await params;
  const web = await cargarWebPublica(decodeURIComponent(referencia));
  const item = web?.inmuebles[0];
  if (!web?.sitio.publicado || !item) return { title: "Inmueble", robots: { index: false, follow: false } };
  return {
    title: `${item.titulo} | ${web.sitio.marca.nombre}`,
    description: item.descripcion.slice(0, 160),
  };
}

export default async function FichaWebPage({
  params,
}: {
  params: Promise<{ referencia: string }>;
}) {
  const { referencia } = await params;
  const web = await cargarWebPublica(decodeURIComponent(referencia));
  const item = web?.inmuebles[0];
  if (!web?.sitio.publicado || !item) notFound();
  const pie = web.bloques.find((b) => b.tipo === "pie")?.contenido.texto ?? web.sitio.marca.nombre;
  return <FichaPublica diseno={web.sitio.diseno} marca={web.sitio.marca} pie={pie} item={item} enDominio={await enDominioPublico()} />;
}
