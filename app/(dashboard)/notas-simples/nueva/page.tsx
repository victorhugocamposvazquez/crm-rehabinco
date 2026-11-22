import type { Metadata } from "next";
import { PedirNotaSimple } from "@/components/notas-simples/PedirNotaSimple";

export const metadata: Metadata = { title: "Pedir nota simple" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function uno(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.slice(0, 300) : undefined;
}

export default async function NuevaNotaSimplePage({ searchParams }: Props) {
  const q = await searchParams;
  return (
    <PedirNotaSimple
      inicial={{
        refCatastral: uno(q.ref),
        direccion: uno(q.direccion),
        municipio: uno(q.municipio),
        provincia: uno(q.provincia),
        propiedadId: uno(q.propiedad),
      }}
    />
  );
}
