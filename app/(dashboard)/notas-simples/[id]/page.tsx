import type { Metadata } from "next";
import { DetalleNotaSimple } from "@/components/notas-simples/DetalleNotaSimple";

export const metadata: Metadata = { title: "Nota simple" };

export default async function NotaSimplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetalleNotaSimple id={id} />;
}
