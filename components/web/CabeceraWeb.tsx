"use client";

import Link from "next/link";
import { hrefInicio } from "@/lib/web/dominio";
import type { MarcaWeb, TemaWeb } from "@/lib/web/modelo";

export function CabeceraWeb({
  marca,
  tema,
  enDominio = false,
  onInicio,
  onInmuebles,
  anclar = false,
}: {
  marca: MarcaWeb;
  tema: TemaWeb;
  enDominio?: boolean;
  onInicio?: () => void;
  onInmuebles?: () => void;
  anclar?: boolean;
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5">
      <Link
        href={hrefInicio(enDominio)}
        className="flex min-w-0 items-center gap-3"
        onClick={
          onInicio
            ? (e) => {
                e.preventDefault();
                onInicio();
              }
            : undefined
        }
      >
        {marca.logo ? (
          <img src={marca.logo} alt="" className="h-9 w-auto max-w-[9rem] object-contain" />
        ) : null}
        <span className="truncate text-[15px] font-semibold tracking-tight" style={{ fontFamily: tema.titulo }}>
          {marca.nombre}
        </span>
      </Link>
      <a
        href="#inmuebles"
        className="shrink-0 text-[13px] font-medium"
        style={{ color: tema.acento }}
        onClick={
          onInmuebles || anclar
            ? (e) => {
                if (onInmuebles) {
                  e.preventDefault();
                  onInmuebles();
                  return;
                }
                const caja = e.currentTarget.closest("[data-vista-web]");
                const destino = caja?.querySelector("#inmuebles");
                if (!destino) return;
                e.preventDefault();
                destino.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            : undefined
        }
      >
        Inmuebles
      </a>
    </header>
  );
}
