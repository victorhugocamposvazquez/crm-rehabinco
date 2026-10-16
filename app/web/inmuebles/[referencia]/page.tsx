import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaCorporativa } from "@/components/web/corporativa/FichaCorporativa";
import { buscarInmueble } from "@/lib/web/corporativa/catalogo";
import { cargarCatalogoCorporativa } from "@/lib/web/corporativa/cargar";
import { enDominioPublico } from "@/lib/web/en-dominio";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ referencia: string }>;
}): Promise<Metadata> {
  const { referencia } = await params;
  const { inmuebles } = await cargarCatalogoCorporativa();
  const item = buscarInmueble(inmuebles, referencia);
  if (!item) return { title: "Inmueble", robots: { index: false, follow: false } };
  return {
    title: `${item.titulo} | Rehabinco`,
    description: item.descripcion.slice(0, 160),
  };
}

export default async function FichaWebPage({
  params,
}: {
  params: Promise<{ referencia: string }>;
}) {
  const { referencia } = await params;
  const enDominio = await enDominioPublico();
  const { inmuebles, publicado } = await cargarCatalogoCorporativa();
  if (enDominio && !publicado) notFound();
  const item = buscarInmueble(inmuebles, referencia);
  if (!item) notFound();
  return <FichaCorporativa item={item} catalogo={inmuebles} enDominio={enDominio} />;
}
