"use client";

import { useMemo, useState } from "react";
import type { InmuebleCorporativa, ModoCorporativa } from "@/lib/web/corporativa/types";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";
import { NavCorporativa } from "./NavCorporativa";
import { PieCorporativa } from "./PieCorporativa";

const TIPOS = ["Todos", "Piso", "Casa", "Dúplex", "Terreno", "Nave"] as const;
const ZONAS = ["Todas las zonas", "A Coruña", "Oleiros", "Culleredo", "Bergondo", "Betanzos", "Vimianzo", "Puebla del Caramiñal", "Cala d'Or"] as const;

export function ListadoCorporativa({
  inmuebles,
  enDominio,
  modoInicial,
}: {
  inmuebles: InmuebleCorporativa[];
  enDominio: boolean;
  modoInicial: ModoCorporativa;
}) {
  const [modo, setModo] = useState<ModoCorporativa>(modoInicial);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Todos");
  const [zona, setZona] = useState<(typeof ZONAS)[number]>("Todas las zonas");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [more, setMore] = useState(false);

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    return inmuebles.filter((item) => {
      if (item.modo !== modo) return false;
      if (tipo !== "Todos" && item.tipo !== tipo) return false;
      if (zona !== "Todas las zonas" && item.municipio !== zona && !item.zona.includes(zona)) return false;
      if (!query) return true;
      const blob = `${item.titulo} ${item.zona} ${item.ref} ${item.tipo}`.toLowerCase();
      return blob.includes(query);
    });
  }, [inmuebles, modo, tipo, zona, q]);

  return (
    <>
      <section className="relative min-h-[440px] overflow-hidden bg-[#080808] text-[#fefefe] md:min-h-[clamp(520px,66vh,680px)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(8,8,8,.82),rgba(8,8,8,.35))]" />
        <NavCorporativa enDominio={enDominio} />
        <div className="corp-pad relative flex min-h-[inherit] flex-col justify-end pb-12 pt-28">
          <h1 className="text-[clamp(48px,10vw,120px)] font-medium leading-[0.86] tracking-[-0.055em]">ENCUENTRA</h1>
          <form
            className="mt-8 flex max-w-3xl flex-col gap-3 rounded-[999px] border border-[rgba(254,254,254,.18)] bg-[rgba(254,254,254,.12)] p-2 backdrop-blur-[18px] md:flex-row md:items-center"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por calle, zona o referencia"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-[rgba(254,254,254,.55)]"
            />
            <button type="submit" className="corp-btn shrink-0">
              Buscar
              <span className="corp-btn-icon">↗</span>
            </button>
          </form>
        </div>
      </section>

      <div className="sticky top-0 z-30 border-b border-[rgba(8,8,8,.08)] bg-[rgba(254,254,254,.86)] backdrop-blur-[18px]">
        <div className="corp-pad flex flex-wrap items-center gap-3 py-4">
          <div className="inline-flex rounded-full bg-[#f4f3f1] p-1 text-[13px]">
            <button type="button" className={`rounded-full px-4 py-2 ${modo === "venta" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setModo("venta")}>
              Comprar
            </button>
            <button type="button" className={`rounded-full px-4 py-2 ${modo === "alquiler" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setModo("alquiler")}>
              Alquilar
            </button>
          </div>
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {TIPOS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${tipo === t ? "border-[#080808] bg-[#080808] text-[#fefefe]" : "border-[rgba(8,8,8,.14)]"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button type="button" className="rounded-full border border-[rgba(8,8,8,.14)] px-3 py-1.5 text-[13px]" onClick={() => setMore((v) => !v)}>
            Filtros
          </button>
          <div className="inline-flex rounded-full border border-[rgba(8,8,8,.14)] p-1 text-[13px]">
            <button type="button" className={`rounded-full px-3 py-1 ${view === "grid" ? "bg-[#fefefe]" : ""}`} onClick={() => setView("grid")}>
              Grid
            </button>
            <button type="button" className={`rounded-full px-3 py-1 ${view === "list" ? "bg-[#fefefe]" : ""}`} onClick={() => setView("list")}>
              Lista
            </button>
          </div>
        </div>
        {more ? (
          <div className="corp-pad border-t border-[rgba(8,8,8,.08)] pb-4 pt-3">
            <label className="flex flex-col gap-1 text-[13px]">
              Zona
              <select value={zona} onChange={(e) => setZona(e.target.value as (typeof ZONAS)[number])} className="rounded-[12px] border border-[rgba(8,8,8,.14)] px-3 py-2">
                {ZONAS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <main id="resultados" className="corp-pad py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[clamp(24px,3vw,32px)] font-medium tracking-[-0.03em]">
              {filtrados.length} {filtrados.length === 1 ? "inmueble" : "inmuebles"}
            </h2>
            <p className="text-[14px] text-[#6b6b6b]">{modo === "venta" ? "en venta" : "en alquiler"}</p>
          </div>
        </div>
        {filtrados.length ? (
          <div className={`grid gap-x-4 gap-y-10 ${view === "list" ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]"}`}>
            {filtrados.map((item) => (
              <TarjetaInmuebleCorporativa key={item.slug} item={item} enDominio={enDominio} lista={view === "list"} />
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] bg-[#f4f3f1] px-6 py-16 text-center">
            <p className="text-[22px] font-medium">No hay nada por aquí</p>
            <p className="mt-2 text-[#6b6b6b]">Prueba a quitar filtros o cuéntanos qué buscas.</p>
            <button type="button" className="corp-btn mt-6" onClick={() => { setTipo("Todos"); setZona("Todas las zonas"); setQ(""); }}>
              Borrar filtros
              <span className="corp-btn-icon">↗</span>
            </button>
          </div>
        )}
      </main>
      <PieCorporativa enDominio={enDominio} />
    </>
  );
}
