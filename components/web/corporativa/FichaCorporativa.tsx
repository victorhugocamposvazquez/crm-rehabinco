"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatoPrecio, similares, specsCortas } from "@/lib/web/corporativa/catalogo";
import type { InmuebleCorporativa } from "@/lib/web/corporativa/types";
import { hrefInicio } from "@/lib/web/dominio";
import { NavCorporativa } from "./NavCorporativa";
import { PieCorporativa } from "./PieCorporativa";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";

export function FichaCorporativa({
  item,
  catalogo,
  enDominio,
}: {
  item: InmuebleCorporativa;
  catalogo: InmuebleCorporativa[];
  enDominio: boolean;
}) {
  const [desc, setDesc] = useState(false);
  const [canal, setCanal] = useState<"form" | "wa">("form");
  const fotos = item.fotos.length ? item.fotos : item.fotoPrincipal ? [item.fotoPrincipal] : [];
  const parecidos = useMemo(() => similares(catalogo, item), [catalogo, item]);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const wa = `https://api.whatsapp.com/send?phone=34664859306&text=${encodeURIComponent(`Hola. Estoy interesado en hablar del «${item.titulo}».\n${url}`)}`;

  return (
    <>
      <div className="bg-[#fefefe] pb-16">
        <section className="relative overflow-hidden bg-[#080808] pb-10 pt-24 text-[#fefefe]">
          <NavCorporativa enDominio={enDominio} />
          <div className="corp-pad">
            <Link href={hrefInicio(enDominio)} className="text-[13px] text-[rgba(254,254,254,.65)]">
              Inicio / Inmuebles / {item.titulo}
            </Link>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] uppercase tracking-[0.06em]">
              <span className="rounded-full border border-[rgba(254,254,254,.2)] px-3 py-1">{item.tipo}</span>
              {item.estadoLabel ? <span className="rounded-full border border-[rgba(254,254,254,.2)] px-3 py-1">{item.estadoLabel}</span> : null}
              {item.origen === "crm" ? <span className="rounded-full bg-[#c9a27a] px-3 py-1 text-[#080808]">Stock Rehabinco</span> : null}
            </div>
            <h1 className="mt-4 max-w-4xl text-[clamp(30px,4.6vw,68px)] font-medium leading-[0.98] tracking-[-0.04em]">{item.titulo}</h1>
            <p className="mt-3 text-[16px] text-[rgba(254,254,254,.72)]">{item.zona}</p>
            <p className="mt-6 text-[clamp(26px,3.4vw,48px)] font-medium tabular-nums text-[#c9a27a]">{formatoPrecio(item)}</p>
          </div>
        </section>

        <div className="corp-pad grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div>
            <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
              {fotos.slice(0, 5).map((foto, i) => (
                <div key={foto + i} className={`overflow-hidden rounded-[18px] bg-[#e9e6e1] ${i === 0 ? "md:col-span-2 md:row-span-2 md:min-h-[360px]" : "min-h-[96px]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt="" className="h-full w-full object-cover" fetchPriority={i === 0 ? "high" : "auto"} />
                </div>
              ))}
            </div>

            <section className="mt-10">
              <p className="corp-kicker">(01) Descripción</p>
              <div className={`mt-4 text-[16px] leading-relaxed text-[#6b6b6b] ${desc ? "" : "line-clamp-6"}`}>
                <p>{item.descripcion}</p>
                {item.descripcionLarga?.map((p) => (
                  <p key={p.slice(0, 24)} className="mt-4">
                    {p}
                  </p>
                ))}
              </div>
              <button type="button" className="mt-3 text-[14px] font-medium underline" onClick={() => setDesc((v) => !v)}>
                {desc ? "Leer menos" : "Leer más"}
              </button>
            </section>

            <section className="mt-10">
              <p className="corp-kicker">(02) Características</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Referencia", item.ref || item.slug],
                  ["Tipo", item.tipo],
                  ["Superficie", item.m2 ? `${item.m2} m²` : "—"],
                  ["Dormitorios", item.dormitorios ? String(item.dormitorios) : "—"],
                  ["Baños", item.banos ? String(item.banos) : "—"],
                  ["Operación", item.modo === "venta" ? "Venta" : "Alquiler"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[14px] bg-[#f4f3f1] px-4 py-3">
                    <p className="text-[12px] text-[#6b6b6b]">{label}</p>
                    <p className="text-[15px] font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {item.extras.length ? (
                <ul className="mt-4 flex flex-wrap gap-2 text-[13px]">
                  {item.extras.map((extra) => (
                    <li key={extra} className="rounded-full bg-[#080808] px-3 py-1 text-[#fefefe]">
                      {extra}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <div className="rounded-[24px] border border-[rgba(8,8,8,.08)] bg-[#fefefe] p-5 shadow-[0_20px_60px_rgba(8,8,8,.06)]">
              <h2 className="text-[18px] font-medium">Contacta por este inmueble</h2>
              <div className="mt-4 inline-flex w-full rounded-full bg-[#f4f3f1] p-1 text-[13px]">
                <button type="button" className={`flex-1 rounded-full py-2 ${canal === "form" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setCanal("form")}>
                  Formulario
                </button>
                <button type="button" className={`flex-1 rounded-full py-2 ${canal === "wa" ? "bg-[#fefefe] shadow-sm" : ""}`} onClick={() => setCanal("wa")}>
                  WhatsApp
                </button>
              </div>
              {canal === "form" ? (
                <form className="mt-4 space-y-3" onSubmit={(e) => e.preventDefault()}>
                  <input placeholder="Nombre" className="w-full rounded-[12px] border border-[rgba(8,8,8,.12)] px-3 py-2.5 text-[14px]" />
                  <input placeholder="Teléfono" className="w-full rounded-[12px] border border-[rgba(8,8,8,.12)] px-3 py-2.5 text-[14px]" />
                  <textarea placeholder="Mensaje" rows={4} className="w-full rounded-[12px] border border-[rgba(8,8,8,.12)] px-3 py-2.5 text-[14px]" defaultValue={`Me interesa ${item.titulo}. ${specsCortas(item)}`} />
                  <button type="submit" className="corp-btn w-full justify-center">
                    Solicitar visita
                    <span className="corp-btn-icon">↗</span>
                  </button>
                </form>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="rounded-[16px] bg-[#f4f3f1] p-4 text-[14px] leading-relaxed">
                    Hola. Estoy interesado en hablar del «{item.titulo}».
                  </p>
                  <a href={wa} target="_blank" rel="noreferrer" className="corp-btn w-full justify-center bg-[#25D366] !text-white">
                    Enviar WhatsApp
                    <span className="corp-btn-icon !bg-white/20 !text-white">↗</span>
                  </a>
                </div>
              )}
            </div>
          </aside>
        </div>

        {parecidos.length ? (
          <section className="corp-pad mt-16">
            <h2 className="corp-h2 text-[clamp(28px,3vw,40px)]">SIMILARES</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {parecidos.map((otro) => (
                <TarjetaInmuebleCorporativa key={otro.slug} item={otro} enDominio={enDominio} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <PieCorporativa enDominio={enDominio} />
    </>
  );
}
