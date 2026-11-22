import type { Metadata } from "next";
import { ListaNotasSimples } from "@/components/notas-simples/ListaNotasSimples";

export const metadata: Metadata = { title: "Notas simples" };

export default function NotasSimplesPage() {
  return <ListaNotasSimples />;
}
