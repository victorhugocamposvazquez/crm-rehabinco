import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { MarcaWeb, TemaWeb } from "@/lib/web/modelo";

export function marcoEstilo(tema: TemaWeb): CSSProperties {
  return {
    background: tema.fondo,
    color: tema.tinta,
    minHeight: "100dvh",
  };
}

export function CabeceraWeb({ marca, tema }: { marca: MarcaWeb; tema: TemaWeb }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5">
      <Link href="/web" className="flex min-w-0 items-center gap-3">
        {marca.logo ? (
          <img src={marca.logo} alt="" className="h-9 w-auto max-w-[9rem] object-contain" />
        ) : null}
        <span className="truncate text-[15px] font-semibold tracking-tight" style={{ fontFamily: tema.titulo }}>
          {marca.nombre}
        </span>
      </Link>
      <a href="#inmuebles" className="shrink-0 text-[13px] font-medium" style={{ color: tema.acento }}>
        Inmuebles
      </a>
    </header>
  );
}

export function PieWeb({ texto, marca, tema }: { texto: string; marca: MarcaWeb; tema: TemaWeb }) {
  return (
    <footer className="mt-16 border-t px-5 py-8" style={{ borderColor: tema.linea }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-[13px]" style={{ color: tema.suave }}>
        <p style={{ color: tema.tinta }}>{texto || marca.nombre}</p>
        <p>
          {[marca.telefono, marca.email].filter(Boolean).join(" · ")}
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
    <div style={marcoEstilo(tema)}>
      {children}
    </div>
  );
}
