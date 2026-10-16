"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BUSQUEDAS, INTERESES, OFICINA, WA } from "@/lib/web/corporativa/contenido";
import { hrefAvisoLegal, hrefInicio, hrefPoliticaCookies } from "@/lib/web/dominio";
import { abrirConfiguracionCookies } from "./CookieBanner";
import { SplitLine } from "./TipografiaMotion";

export function ContactoFooter({ enDominio }: { enDominio: boolean }) {
  const [interes, setInteres] = useState(0);
  const [canal, setCanal] = useState<"form" | "wa">("form");
  const inicio = hrefInicio(enDominio);

  const waMsg = useMemo(() => {
    const label = INTERESES[interes] ?? "Comprar";
    return `Hola Rehabinco. Me gustaría hablar sobre ${label.toLowerCase()}.`;
  }, [interes]);

  return (
    <footer id="contacto" className="relative mx-2 mb-2 overflow-hidden rounded-[28px] bg-[#080808] text-[#fefefe] md:mx-4">
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/web/assets/jardin.jpg" alt="" className="h-full w-full scale-[1.12] object-cover opacity-[0.42]" />
      </div>
      <div className="relative flex flex-col gap-14 px-[clamp(16px,2.6vw,40px)] py-[clamp(56px,7vw,110px)] md:gap-[clamp(56px,7vw,100px)]">
        <div className="grid items-start gap-12 md:grid-cols-2 md:gap-20">
          <div className="flex flex-col gap-7">
            <h2 className="corp-h2 !text-[#fefefe]">
              <SplitLine name="c1" text="PIDE UNA" />
              <SplitLine name="c2" text="VISITA" />
            </h2>
            <div className="grid gap-6 text-[15px] leading-relaxed sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] uppercase tracking-[0.06em] text-[#9a9a9a]">Oficina</span>
                <span>
                  {OFICINA.direccion}
                  <br />
                  {OFICINA.ciudad}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] uppercase tracking-[0.06em] text-[#9a9a9a]">Contacto</span>
                <a href={`tel:+34${OFICINA.telefono.replace(/\s/g, "")}`}>{OFICINA.telefono}</a>
                <a href={`mailto:${OFICINA.email}`}>{OFICINA.email}</a>
              </div>
            </div>
          </div>
          <form
            className="flex flex-col gap-4 rounded-[24px] border border-[rgba(254,254,254,.16)] bg-[rgba(254,254,254,.08)] p-[clamp(20px,2.4vw,32px)] backdrop-blur-md"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] uppercase tracking-[0.06em] text-[rgba(254,254,254,.7)]">Quiero</span>
              <div className="flex flex-wrap gap-1.5">
                {INTERESES.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setInteres(i)}
                    className={`rounded-full px-3.5 py-2 text-[13px] transition-colors ${interes === i ? "border border-[#fefefe] bg-[#fefefe] text-[#080808]" : "border border-[rgba(254,254,254,.35)] bg-transparent text-[#fefefe]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] uppercase tracking-[0.06em] text-[rgba(254,254,254,.7)]">Cómo prefieres hablar</span>
              <div className="flex gap-1 rounded-[14px] bg-[rgba(254,254,254,.1)] p-1">
                <button
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] py-2.5 text-[14px] font-medium ${canal === "form" ? "bg-[#fefefe] text-[#080808]" : "text-[#fefefe]"}`}
                  onClick={() => setCanal("form")}
                >
                  Os dejo mis datos
                </button>
                <button
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] py-2.5 text-[14px] font-medium ${canal === "wa" ? "bg-[#fefefe] text-[#080808]" : "text-[#fefefe]"}`}
                  onClick={() => setCanal("wa")}
                >
                  WhatsApp
                </button>
              </div>
            </div>
            {canal === "form" ? (
              <>
                <input placeholder="Nombre" className="rounded-[12px] border-0 bg-[#fefefe] px-4 py-3.5 text-[15px] text-[#080808] outline-none" />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <input placeholder="Teléfono" className="rounded-[12px] border-0 bg-[#fefefe] px-4 py-3.5 text-[15px] text-[#080808] outline-none" />
                  <input placeholder="Email" type="email" className="rounded-[12px] border-0 bg-[#fefefe] px-4 py-3.5 text-[15px] text-[#080808] outline-none" />
                </div>
                <textarea
                  rows={3}
                  placeholder={`Cuéntanos qué buscas (${INTERESES[interes]?.toLowerCase()})…`}
                  className="resize-y rounded-[12px] border-0 bg-[#fefefe] px-4 py-3.5 text-[15px] text-[#080808] outline-none"
                />
              </>
            ) : (
              <div className="flex flex-col gap-2 rounded-[16px] border border-dashed border-[rgba(254,254,254,.22)] bg-[rgba(254,254,254,.06)] p-[18px]">
                <span className="text-[12px] text-[rgba(254,254,254,.7)]">Tu mensaje · puedes editarlo en WhatsApp</span>
                <p className="ml-auto max-w-[92%] rounded-[16px_16px_4px_16px] bg-[#fefefe] px-3.5 py-3 text-[15px] leading-relaxed text-[#080808]">{waMsg}</p>
              </div>
            )}
            {canal === "form" ? (
              <button type="submit" className="flex items-center justify-between gap-3 rounded-[13px] bg-[#fefefe] py-1.5 pl-[18px] pr-1.5 text-[15px] font-medium text-[#080808]">
                Enviar mensaje
                <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#080808] text-[#fefefe]">↗</span>
              </button>
            ) : (
              <a
                href={`https://api.whatsapp.com/send?phone=${WA}&text=${encodeURIComponent(waMsg)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-[13px] bg-[#fefefe] py-1.5 pl-[18px] pr-1.5 text-[15px] font-medium text-[#080808]"
              >
                Abrir WhatsApp
                <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#080808] text-[#fefefe]">↗</span>
              </a>
            )}
          </form>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-[rgba(254,254,254,.16)] pb-3 text-[14px]">
            <span className="text-[12px] uppercase tracking-[0.06em] text-[#9a9a9a]">Búsquedas frecuentes</span>
            {BUSQUEDAS.map((b) => (
              <Link key={b} href={`${inicio}#pisos`} className="text-[rgba(254,254,254,.85)] hover:text-[#fefefe]">
                {b}
              </Link>
            ))}
          </div>
          <div className="py-2">
            <Image src="/web/assets/rh-logo-blanco.svg" alt="Rehabinco" width={1600} height={200} className="h-auto w-full max-w-[1600px]" />
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-[rgba(254,254,254,.16)] pt-5 text-[13px] text-[#9a9a9a]">
            <span>© {new Date().getFullYear()} Rehabinco Gestión Inmobiliaria y Reformas</span>
            <div className="flex flex-wrap gap-5">
              <a href="https://www.instagram.com/rehabinco1/" target="_blank" rel="noreferrer" className="hover:text-[#fefefe]">
                Instagram
              </a>
              <a href={`https://api.whatsapp.com/send?phone=${WA}`} target="_blank" rel="noreferrer" className="hover:text-[#fefefe]">
                WhatsApp
              </a>
              <Link href={hrefAvisoLegal(enDominio)} className="hover:text-[#fefefe]">
                Aviso legal
              </Link>
              <Link href={hrefPoliticaCookies(enDominio)} className="hover:text-[#fefefe]">
                Política de cookies
              </Link>
              <button type="button" className="hover:text-[#fefefe]" onClick={() => abrirConfiguracionCookies()}>
                Configurar cookies
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
