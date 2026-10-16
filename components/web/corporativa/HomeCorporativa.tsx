"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InmuebleCorporativa, ModoCorporativa } from "@/lib/web/corporativa/types";
import { hrefInmueble, hrefInmuebles } from "@/lib/web/dominio";
import { NavCorporativa } from "./NavCorporativa";
import { PieCorporativa } from "./PieCorporativa";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";

const SERVICIOS = [
  ["Compraventa", "Buscamos, negociamos y te acompañamos hasta notaría."],
  ["Reformas", "Equipo propio de obra con presupuesto cerrado."],
  ["Alquiler", "Selección de inquilino y gestión del contrato."],
  ["Financiación", "Comparamos entidades y tramitamos la hipoteca."],
];

export function HomeCorporativa({ inmuebles, enDominio }: { inmuebles: InmuebleCorporativa[]; enDominio: boolean }) {
  const [modo, setModo] = useState<ModoCorporativa>("venta");
  const destacados = useMemo(() => inmuebles.filter((i) => i.modo === modo).slice(0, 3), [inmuebles, modo]);

  return (
    <>
      <section className="relative min-h-[78svh] overflow-hidden bg-[#080808] text-[#fefefe] md:min-h-[clamp(640px,100vh,1040px)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(8,8,8,.78), rgba(8,8,8,.25)), radial-gradient(circle at 20% 20%, rgba(201,162,122,.25), transparent 40%), url('https://img4.idealista.com/blur/HOME_WI_600/0/id.pro.es.image.master/72/ac/66/1469562803.jpg')",
          }}
        />
        <NavCorporativa enDominio={enDominio} />
        <div className="corp-pad relative flex min-h-[inherit] flex-col justify-end pb-16 pt-28">
          <p className="max-w-3xl text-[clamp(22px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.03em] [text-shadow:0_1px_2px_rgba(8,8,8,.55)]">
            EL PISO QUE BUSCAS.
            <br />
            LA REFORMA QUE SUEÑAS.
            <br />
            UN SOLO EQUIPO PARA <span className="underline decoration-[#c9a27a] decoration-[3px] underline-offset-[6px]">TODO.</span>
          </p>
          <div className="mt-10 max-w-2xl rounded-[28px] border border-[rgba(254,254,254,.16)] bg-[rgba(254,254,254,.14)] p-3 backdrop-blur-[22px]">
            <div className="mb-3 inline-flex rounded-full bg-[rgba(8,8,8,.35)] p-1 text-[13px]">
              <button type="button" className={`rounded-full px-4 py-2 ${modo === "venta" ? "bg-[#fefefe] text-[#080808]" : ""}`} onClick={() => setModo("venta")}>
                Comprar
              </button>
              <button type="button" className={`rounded-full px-4 py-2 ${modo === "alquiler" ? "bg-[#fefefe] text-[#080808]" : ""}`} onClick={() => setModo("alquiler")}>
                Alquilar
              </button>
            </div>
            <Link href={hrefInmuebles(enDominio, modo)} className="corp-btn w-full justify-between md:w-auto">
              Ver inmuebles
              <span className="corp-btn-icon">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="corp-pad py-[clamp(80px,10vw,120px)]">
        <p className="corp-kicker">(01) Quiénes somos</p>
        <p className="mt-6 max-w-4xl text-[clamp(22px,3vw,40px)] font-medium leading-[1.2] tracking-[-0.03em]">
          Una inmobiliaria de A Coruña que también reforma. Compramos, vendemos y alquilamos pisos y, cuando hace falta, los rehabilitamos con nuestro propio equipo de obra.
        </p>
      </section>

      <section id="pisos" className="relative z-[3] -mt-[18vh] rounded-t-[28px] bg-[#fefefe] px-0 pb-16 pt-10 shadow-[0_-40px_90px_rgba(8,8,8,.28)]">
        <div className="corp-pad flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="corp-kicker">(02) Pisos destacados</p>
            <h2 className="corp-h2 mt-3">PISOS DESTACADOS</h2>
          </div>
          <div className="inline-flex rounded-full bg-[#f4f3f1] p-1 text-[13px]">
            <button type="button" className={`rounded-full px-4 py-2 ${modo === "venta" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setModo("venta")}>
              Venta
            </button>
            <button type="button" className={`rounded-full px-4 py-2 ${modo === "alquiler" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setModo("alquiler")}>
              Alquiler
            </button>
          </div>
        </div>
        <div className="corp-pad mt-8 grid gap-4 md:grid-cols-3">
          {destacados.map((item) => (
            <TarjetaInmuebleCorporativa key={item.slug} item={item} enDominio={enDominio} />
          ))}
        </div>
        <div className="corp-pad mt-8">
          <Link href={hrefInmuebles(enDominio, modo)} className="corp-btn">
            Ver todos
            <span className="corp-btn-icon">↗</span>
          </Link>
        </div>
      </section>

      <section id="servicios" className="corp-pad py-[clamp(80px,10vw,120px)]">
        <p className="corp-kicker">(04) Servicios</p>
        <h2 className="corp-h2 mt-3">SIEMPRE A TU SERVICIO</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {SERVICIOS.map(([titulo, texto]) => (
            <article key={titulo} className="rounded-[22px] bg-[#f4f3f1] p-6">
              <h3 className="text-[20px] font-medium tracking-[-0.02em]">{titulo}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#6b6b6b]">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <PieCorporativa enDominio={enDominio} />
    </>
  );
}
