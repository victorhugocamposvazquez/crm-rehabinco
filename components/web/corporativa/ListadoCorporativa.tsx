"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BUSQUEDAS } from "@/lib/web/corporativa/contenido";
import type { InmuebleCorporativa, ModoCorporativa } from "@/lib/web/corporativa/types";
import { hrefInicio } from "@/lib/web/dominio";
import { NavCorporativa } from "./NavCorporativa";
import { ContactoFooter } from "./ContactoFooter";
import { SplitLine } from "./TipografiaMotion";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";
import { initWebMotion } from "./motion";

const TIPOS = ["Todos", "Piso", "Casa", "Dúplex", "Terreno", "Nave"] as const;
const ZONAS = ["Todas las zonas", "A Coruña", "Oleiros", "Culleredo", "Bergondo", "Betanzos", "Vimianzo", "Puebla del Caramiñal", "Cala d'Or"] as const;

export function ListadoCorporativa({
  inmuebles,
  enDominio,
  modoInicial,
  qInicial = "",
}: {
  inmuebles: InmuebleCorporativa[];
  enDominio: boolean;
  modoInicial: ModoCorporativa;
  qInicial?: string;
}) {
  const [modo, setModo] = useState<ModoCorporativa>(modoInicial);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Todos");
  const [zona, setZona] = useState<(typeof ZONAS)[number]>("Todas las zonas");
  const [q, setQ] = useState(qInicial);
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return initWebMotion(root);
  }, []);

  return (
    <div ref={rootRef} className="corp-page">
      <section className="corp-inset-x relative mt-3 min-h-[380px] overflow-hidden rounded-[28px] bg-[#1b2340] text-[#fefefe] md:mt-4 md:min-h-[clamp(520px,66vh,680px)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/web/assets/hero-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_70%]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(8,8,8,.78),rgba(8,8,8,.12)_60%,rgba(8,8,8,.3))]" />
        <NavCorporativa enDominio={enDominio} />
        <div className="corp-pad relative z-[2] flex min-h-[inherit] w-full min-w-0 flex-col justify-end gap-5 pb-5 pt-24 md:gap-8 md:pb-[clamp(20px,2.6vw,36px)] md:pt-28">
          <div className="min-w-0 max-w-full">
            <p className="text-[12px] uppercase tracking-[0.06em] text-[rgba(254,254,254,.82)]">(Inmuebles) {modo === "venta" ? "en venta" : "en alquiler"}</p>
            <h1 className="mt-2 max-w-full text-[clamp(36px,12vw,168px)] font-medium leading-[0.9] tracking-[-0.05em]">
              <SplitLine name="encuentra" text="ENCUENTRA" />
            </h1>
          </div>
          <form
            className="flex w-full min-w-0 max-w-3xl items-center gap-2 rounded-full border border-[rgba(254,254,254,.28)] bg-[rgba(254,254,254,.14)] py-1.5 pl-4 pr-1.5 backdrop-blur-[18px]"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="sr-only" htmlFor="busca-inmueble">
              Buscar por calle, zona o referencia
            </label>
            <input
              id="busca-inmueble"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Calle, zona o referencia"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] text-[#fefefe] outline-none placeholder:text-[rgba(254,254,254,.72)]"
            />
            <button type="submit" className="corp-btn shrink-0">
              Buscar
              <span className="corp-btn-icon">↗</span>
            </button>
          </form>
        </div>
      </section>

      <div className="sticky top-0 z-30 w-full min-w-0 border-b border-[rgba(8,8,8,.08)] bg-[rgba(254,254,254,.86)] backdrop-blur-[18px]">
        <div className="corp-pad flex w-full min-w-0 flex-col gap-3 py-3 md:flex-row md:flex-wrap md:items-center md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-[#f4f3f1] p-1 text-[13px]">
              <button type="button" className={`rounded-full px-4 py-2 ${modo === "venta" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setModo("venta")}>
                Comprar
              </button>
              <button type="button" className={`rounded-full px-4 py-2 ${modo === "alquiler" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setModo("alquiler")}>
                Alquilar
              </button>
            </div>
            <div className="inline-flex rounded-full border border-[rgba(8,8,8,.14)] p-1 text-[13px] md:hidden">
              <button type="button" className={`rounded-full px-3 py-1 ${view === "grid" ? "bg-[#f4f3f1]" : ""}`} onClick={() => setView("grid")}>
                Grid
              </button>
              <button type="button" className={`rounded-full px-3 py-1 ${view === "list" ? "bg-[#f4f3f1]" : ""}`} onClick={() => setView("list")}>
                Lista
              </button>
            </div>
          </div>
          <div className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] md:flex-1">
            <button type="button" className="shrink-0 rounded-full border border-[rgba(8,8,8,.14)] px-3 py-1.5 text-[13px] md:hidden" onClick={() => setMore((v) => !v)}>
              Filtros
            </button>
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
          <button type="button" className="hidden shrink-0 rounded-full border border-[rgba(8,8,8,.14)] px-3 py-1.5 text-[13px] md:inline" onClick={() => setMore((v) => !v)}>
            Filtros
          </button>
          <div className="hidden rounded-full border border-[rgba(8,8,8,.14)] p-1 text-[13px] md:inline-flex">
            <button type="button" className={`rounded-full px-3 py-1 ${view === "grid" ? "bg-[#f4f3f1]" : ""}`} onClick={() => setView("grid")}>
              Grid
            </button>
            <button type="button" className={`rounded-full px-3 py-1 ${view === "list" ? "bg-[#f4f3f1]" : ""}`} onClick={() => setView("list")}>
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

      <main id="resultados" className="corp-pad w-full min-w-0 py-10">
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

      <section className="corp-pad w-full min-w-0 pb-16">
        <div className="grid w-full min-w-0 items-center gap-8 rounded-[28px] bg-[#080808] p-6 text-[#fefefe] sm:p-8 md:grid-cols-[1fr_auto] md:p-[clamp(28px,4vw,48px)]">
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.06em] text-[#9a9a9a]">Personal shopper</p>
            <h2 className="mt-2 max-w-lg text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.05] tracking-[-0.03em]">¿No encuentras lo que buscas? Lo buscamos por ti.</h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[rgba(254,254,254,.82)]">
              Acceso a oportunidades fuera del mercado publicado, visitas preseleccionadas y negociación en tu interés.
            </p>
          </div>
          <Link href={`${hrefInicio(enDominio)}#contacto`} className="corp-btn !bg-[#fefefe] !text-[#080808] shrink-0">
            Cuéntanos qué buscas
            <span className="corp-btn-icon !bg-[#080808] !text-[#fefefe]">↗</span>
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[14px] text-[#6b6b6b]">
          <span className="text-[12px] uppercase tracking-[0.06em]">Búsquedas frecuentes</span>
          {BUSQUEDAS.map((b) => (
            <button key={b} type="button" className="hover:text-[#080808]" onClick={() => setQ(b.split("–")[0]?.trim() ?? b)}>
              {b}
            </button>
          ))}
        </div>
      </section>

      <ContactoFooter enDominio={enDominio} />
    </div>
  );
}
