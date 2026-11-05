import type { CSSProperties, ReactNode } from "react";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import type { MarcaWeb, TemaWeb } from "@/lib/web/modelo";

export function lineaContactoMarca(marca: MarcaWeb): string {
  const cif = /rehabinco/i.test(marca.nombre) ? `CIF ${EMPRESA_DOCUMENTOS.cif}` : null;
  return [cif, marca.telefono, marca.email].filter(Boolean).join(" · ");
}

export { CabeceraWeb } from "./CabeceraWeb";

export function marcoEstilo(tema: TemaWeb): CSSProperties {
  return {
    background: tema.fondo,
    color: tema.tinta,
    minHeight: "100dvh",
  };
}

export function PieWeb({ texto, marca, tema }: { texto: string; marca: MarcaWeb; tema: TemaWeb }) {
  return (
    <footer className="mt-16 border-t px-5 py-8" style={{ borderColor: tema.linea }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-[13px]" style={{ color: tema.suave }}>
        <p style={{ color: tema.tinta }}>{texto || marca.nombre}</p>
        <p>
          {lineaContactoMarca(marca)}
        </p>
      </div>
    </footer>
  );
}

export function MarcoWeb({
  tema,
  children,
}: {
  tema: TemaWeb;
  children: ReactNode;
}) {
  return (
    <div className="web-marco" style={marcoEstilo(tema)}>
      {children}
    </div>
  );
}
