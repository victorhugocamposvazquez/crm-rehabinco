"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  A,
  FAQS,
  FASES_360,
  HUMAN_FILL,
  QUIENES_FILL,
  REFORMAS,
  REFORMAS_CIERRA,
  REVIEWS,
  SERVICIOS_DETALLE,
  SERVICIOS_RESUMEN,
  UPDATES_360,
  VENTAJAS,
} from "@/lib/web/corporativa/contenido";
import type { InmuebleCorporativa, ModoCorporativa } from "@/lib/web/corporativa/types";
import { hrefInmuebles } from "@/lib/web/dominio";
import { ContactoFooter } from "./ContactoFooter";
import { IconoServicio } from "./IconoMarca";
import { initWebMotion } from "./motion";
import { ModalServicio } from "./ModalServicio";
import { NavCorporativa } from "./NavCorporativa";
import { FillText, PalabraHero, SplitLine } from "./TipografiaMotion";
import { SeccionDiferenciaRehabinco } from "./SeccionDiferenciaRehabinco";
import { GridFases360 } from "./TarjetaFase360";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";

const PRECIOS_VENTA = ["Indiferente", "Hasta 150.000 €", "150.000 – 250.000 €", "250.000 – 400.000 €", "400.000 € o más"];
const PRECIOS_ALQ = ["Indiferente", "Hasta 800 €/mes", "800 – 1.200 €/mes", "1.200 €/mes o más"];

export function HomeCorporativa({ inmuebles, enDominio }: { inmuebles: InmuebleCorporativa[]; enDominio: boolean }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [modo, setModo] = useState<ModoCorporativa>("venta");
  const [busqueda, setBusqueda] = useState("");
  const [ventajaAbierta, setVentajaAbierta] = useState(0);
  const [faqAbierta, setFaqAbierta] = useState(0);
  const [reformaActiva, setReformaActiva] = useState(0);
  const [servicioHover, setServicioHover] = useState(-1);
  const [modalServicio, setModalServicio] = useState(-1);
  const [review, setReview] = useState(0);

  const destacados = useMemo(() => inmuebles.filter((i) => i.modo === modo).slice(0, 3), [inmuebles, modo]);
  const reviewActive = REVIEWS[review] ?? REVIEWS[0]!;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return initWebMotion(root);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) setReview((r) => (r + 1) % REVIEWS.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = busqueda.trim();
    router.push(hrefInmuebles(enDominio, modo, q || undefined));
  };

  return (
    <div ref={rootRef}>
      <div data-travel="" aria-hidden className="pointer-events-none fixed left-0 top-0 z-30 h-0 w-0" style={{ visibility: "hidden" }}>
        <div data-tv-line="" className="absolute left-0 top-0 w-px origin-top-left bg-gradient-to-b from-[#080808] to-transparent" style={{ height: 0 }} />
        <svg data-tv-icon="" viewBox="-3.5 25.5 127 69" className="absolute left-0 top-0 h-[70px] w-[128px] overflow-visible" style={{ transformOrigin: "0 0" }}>
          <path d="M39 81L60 39L81 81" fill="none" stroke="#080808" strokeWidth="7" strokeLinejoin="miter" />
          <rect data-tv-bar="" x="6.5" y="80.2" width="22" height="1.6" fill="#080808" />
          <rect data-tv-bar="" x="91.5" y="80.2" width="22" height="1.6" fill="#080808" />
        </svg>
      </div>
      <header data-hero="" className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#1b2340] text-[#fefefe] md:h-auto md:min-h-[clamp(640px,100vh,1040px)]">
        <div data-hero-bg="" className="absolute inset-[-4%_0_0_0]" style={{ willChange: "transform" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/web/assets/hero-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        </div>
        <PalabraHero />
        <div data-hero-fg="" className="pointer-events-none absolute inset-[-4%_0_0_0]" style={{ willChange: "transform" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/web/assets/hero-cutout.png" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        </div>
        <PalabraHero outline />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[rgba(8,8,8,.72)] to-transparent" />
        <NavCorporativa enDominio={enDominio} />
        <div className="absolute inset-0 z-[4] flex flex-col px-[clamp(16px,2.6vw,40px)] pb-[clamp(20px,2.6vw,36px)] pt-[22vh] md:inset-x-0 md:bottom-0 md:top-auto md:gap-[clamp(40px,6vh,80px)] md:pt-0">
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center md:flex-none md:justify-end">
            <div data-enter="200" className="flex flex-col gap-0.5 text-[clamp(20px,2.3vw,34px)] font-medium leading-[1.05] tracking-[-0.03em] [text-shadow:0_1px_2px_rgba(8,8,8,.55),0_2px_24px_rgba(8,8,8,.5)]">
              <span>EL PISO QUE BUSCAS.</span>
              <span>LA REFORMA QUE SUEÑAS.</span>
              <span>
                UN SOLO EQUIPO PARA{" "}
                <span className="relative inline-block">
                  TODO.
                  <span aria-hidden className="absolute bottom-[-0.12em] left-0 right-[0.25em] h-[3px] rounded-sm bg-[#c9a27a]" />
                </span>
              </span>
            </div>
          </div>
          <form data-enter="420" onSubmit={buscar} className="mx-auto flex w-full max-w-[940px] flex-col gap-3">
            <div className="flex gap-5 pl-[22px] text-[14px] font-medium">
              <button type="button" className={`border-b pb-1 ${modo === "venta" ? "border-[#fefefe] text-[#fefefe]" : "border-transparent text-[rgba(254,254,254,.55)]"}`} onClick={() => setModo("venta")}>
                Comprar
              </button>
              <button type="button" className={`border-b pb-1 ${modo === "alquiler" ? "border-[#fefefe] text-[#fefefe]" : "border-transparent text-[rgba(254,254,254,.55)]"}`} onClick={() => setModo("alquiler")}>
                Alquilar
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-[999px] border border-[rgba(254,254,254,.28)] bg-[rgba(254,254,254,.14)] py-1.5 pl-[22px] pr-1.5 backdrop-blur-[22px]">
              <label className="flex min-w-[160px] flex-1 cursor-text items-center gap-3">
                <span className="sr-only">Zona</span>
                <input
                  list="zonas-list"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Barrio, calle o zona"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 text-[15px] text-[#fefefe] outline-none placeholder:text-[rgba(254,254,254,.72)]"
                />
                <datalist id="zonas-list">
                  <option value="Ciudad Vieja" />
                  <option value="Ensanche" />
                  <option value="Monte Alto" />
                  <option value="Riazor – Os Rosales" />
                  <option value="Os Mallos" />
                  <option value="Santanyí, Mallorca" />
                </datalist>
              </label>
              <label className="hidden min-w-[140px] flex-col gap-0.5 border-l border-[rgba(254,254,254,.22)] px-5 md:flex">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[rgba(254,254,254,.72)]">{modo === "venta" ? "Precio" : "Renta"}</span>
                <select className="cursor-pointer border-0 bg-transparent text-[15px] font-medium text-[#fefefe] outline-none">
                  {(modo === "venta" ? PRECIOS_VENTA : PRECIOS_ALQ).map((p) => (
                    <option key={p} className="text-[#080808]">
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hidden min-w-[140px] flex-col gap-0.5 border-l border-[rgba(254,254,254,.22)] px-5 md:flex">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[rgba(254,254,254,.72)]">Habitaciones</span>
                <select className="cursor-pointer border-0 bg-transparent text-[15px] font-medium text-[#fefefe] outline-none">
                  <option className="text-[#080808]">Indiferente</option>
                  <option className="text-[#080808]">1 o más</option>
                  <option className="text-[#080808]">2 o más</option>
                  <option className="text-[#080808]">3 o más</option>
                </select>
              </label>
              <button type="submit" className="ml-1.5 inline-flex h-[50px] shrink-0 items-center justify-center rounded-full bg-[#fefefe] px-6 text-[15px] font-medium text-[#080808] hover:bg-[#f4f3f1]">
                Buscar
              </button>
            </div>
          </form>
        </div>
      </header>

      <section className="corp-pad flex flex-col gap-[clamp(48px,6vw,88px)] pb-0 pt-[clamp(80px,10vw,150px)]">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,320px)_1fr_1fr] md:gap-12">
          <p data-enter="0" className="corp-kicker">(01) Quiénes somos</p>
          <FillText text={QUIENES_FILL} className="max-w-[26ch] md:col-span-2" />
        </div>
        <div data-iconzoom="" className="relative -mx-[clamp(16px,2.6vw,40px)] h-[280vh]">
          <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#080808]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-iz-img="" src={`${A}/aerea.jpg`} alt="Vista aérea" className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scale(1.18)" }} />
            <svg viewBox="-3.5 25.5 127 69" preserveAspectRatio="xMidYMid meet" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <mask id="rh-zoom-mask" maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={4200} height={4200}>
                  <rect x={-2000} y={-2000} width={4200} height={4200} fill="#fff" />
                  <g data-iz-g="" transform="translate(60 66) scale(0.75) translate(-60 -66)">
                    <polygon points="39,81 60,39 81,81" fill="#000" />
                  </g>
                </mask>
              </defs>
              <rect data-iz-shade="" x={-2000} y={-2000} width={4200} height={4200} fill="#080808" fillOpacity={0.68} mask="url(#rh-zoom-mask)" />
              <g data-iz-g="" data-iz-stroke="" transform="translate(60 66) scale(0.75) translate(-60 -66)">
                <path data-iz-roof="" d="M39 81L60 39L81 81" fill="none" stroke="#fefefe" strokeWidth="3.2" strokeLinejoin="miter" strokeDasharray="94" strokeDashoffset="94" />
                <path data-iz-line="" d="M28.5 81H6.5" fill="none" stroke="#fefefe" strokeWidth="1.2" strokeDasharray="22" strokeDashoffset="22" />
                <path data-iz-line="" d="M91.5 81H113.5" fill="none" stroke="#fefefe" strokeWidth="1.2" strokeDasharray="22" strokeDashoffset="22" />
              </g>
            </svg>
            <div data-iz-cap="" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-[#fefefe]" style={{ opacity: 0, translate: "0 28px" }}>
              <h2>
                TU PRÓXIMO HOGAR
                <br />
                EMPIEZA AQUÍ
              </h2>
            </div>
          </div>
        </div>
      </section>

      <section id="pisos" className="relative z-[3] -mt-[34vh] rounded-t-[28px] bg-[#fefefe] px-0 pb-[clamp(40px,5vw,80px)] pt-[clamp(28px,3vw,40px)] shadow-[0_-40px_90px_rgba(8,8,8,.28)]">
        <div data-roof-return="" aria-hidden className="corp-pad flex justify-center overflow-x-clip py-2">
          <svg data-rr-icon="" width="128" height="70" viewBox="-3.5 25.5 127 69" className="overflow-visible" style={{ transformOrigin: "50% 80%" }}>
            <path d="M39 81L60 39L81 81" fill="none" stroke="#080808" strokeWidth="7" strokeLinejoin="miter" />
            <rect x="6.5" y="80.2" width="22" height="1.6" fill="#080808" />
            <rect x="91.5" y="80.2" width="22" height="1.6" fill="#080808" />
          </svg>
        </div>
        <div className="corp-pad flex flex-wrap items-end justify-between gap-6">
          <div>
            <p data-enter="0" className="corp-kicker">(02) Pisos destacados</p>
            <h2 className="corp-h2 mt-3">
              <SplitLine name="p1" text="PISOS" />
              <SplitLine name="p2" text="DESTACADOS" />
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex rounded-[14px] bg-[#f4f3f1] p-1 text-[14px]">
              <button type="button" className={`rounded-[10px] px-4 py-2 font-medium ${modo === "venta" ? "bg-[#fefefe]" : ""}`} onClick={() => setModo("venta")}>
                Venta
              </button>
              <button type="button" className={`rounded-[10px] px-4 py-2 font-medium ${modo === "alquiler" ? "bg-[#fefefe]" : ""}`} onClick={() => setModo("alquiler")}>
                Alquiler
              </button>
            </div>
            <Link href={hrefInmuebles(enDominio, modo)} className="text-[14px] font-medium underline underline-offset-4">
              Ver todos ↗
            </Link>
          </div>
        </div>
        <div className="corp-pad mt-10 grid gap-10 md:grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {destacados.map((item) => (
            <TarjetaInmuebleCorporativa key={item.slug} item={item} enDominio={enDominio} />
          ))}
        </div>
      </section>

      <section className="corp-pad grid items-start gap-12 pb-0 pt-[clamp(80px,10vw,150px)] md:grid-cols-2 md:gap-20">
        <div data-px="" className="max-h-[860px] overflow-hidden rounded-[28px] bg-[#f4f3f1] aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/salon.jpg`} alt="Salón reformado" className="h-full w-full scale-[1.12] object-cover" />
        </div>
        <div className="flex flex-col gap-10">
          <div>
            <p data-enter="0" className="corp-kicker">(03) Te ofrecemos</p>
            <h2 className="corp-h2 mt-3">
              <SplitLine name="v1" text="CONFÍA EN" />
              <SplitLine name="v2" text="LOS QUE SABEN" />
            </h2>
          </div>
          <div className="border-t border-[rgba(8,8,8,.14)]">
            {VENTAJAS.map(([titulo, texto], i) => {
              const open = ventajaAbierta === i;
              return (
                <div key={titulo} className="border-b border-[rgba(8,8,8,.14)]">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[44px_1fr_16px] items-center gap-3 py-5 text-left"
                    onClick={() => setVentajaAbierta(open ? -1 : i)}
                  >
                    <span className="text-[13px] text-[#9a9a9a]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[clamp(18px,1.5vw,22px)] font-medium tracking-[-0.02em]">{titulo}</span>
                    <span className={`text-lg transition-transform ${open ? "rotate-45" : ""}`}>+</span>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <p className="max-w-[52ch] pb-5 pl-14 pr-0 text-[15px] leading-relaxed text-[#6b6b6b]">{texto}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="servicios" className="corp-pad flex flex-col gap-10 pb-0 pt-[clamp(80px,10vw,150px)]">
        <div className="grid items-end gap-8 md:grid-cols-2">
          <div>
            <p data-enter="0" className="corp-kicker">(04) Servicios</p>
            <h2 className="corp-h2 mt-3">
              <SplitLine name="sv1" text="SIEMPRE A" />
              <SplitLine name="sv2" text="TU SERVICIO" />
            </h2>
          </div>
          <p data-enter="120" className="max-w-[48ch] text-[16px] leading-relaxed text-[#6b6b6b]">
            Un servicio completo y personalizado: te acompañamos desde el primer contacto hasta mucho después de la firma, con la visión de quienes también invierten en el sector.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {SERVICIOS_RESUMEN.map(([titulo, texto], i) => {
            const on = servicioHover === i;
            const big = i === 0 || i === 3 || i === 6;
            const det = SERVICIOS_DETALLE[i]!;
            return (
              <div
                key={titulo}
                role="button"
                tabIndex={0}
                className={`relative flex min-h-[clamp(340px,30vw,440px)] cursor-pointer flex-col overflow-hidden rounded-[22px] bg-[#151515] text-[#fefefe] outline-none ${big ? "min-w-[min(100%,520px)] flex-[2_1_520px]" : "min-w-[min(100%,260px)] flex-[1_1_260px]"}`}
                onMouseEnter={() => setServicioHover(i)}
                onMouseLeave={() => setServicioHover(-1)}
                onClick={() => setModalServicio(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setModalServicio(i);
                  }
                }}
              >
                <div className={`absolute inset-0 transition-transform duration-700 ${on ? "scale-105" : "scale-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={det.img} alt="" className="h-full w-full object-cover" />
                </div>
                <div className={`absolute inset-0 bg-gradient-to-t from-[rgba(8,8,8,.88)] via-[rgba(8,8,8,.3)] to-[rgba(8,8,8,.12)] transition-opacity ${on ? "opacity-100" : "opacity-90"}`} />
                <div className="relative flex flex-1 flex-col justify-between p-[22px]">
                  <div className="flex items-center justify-between">
                    <span className="grid h-[46px] w-[46px] place-items-center rounded-[14px] border border-[rgba(254,254,254,.22)] bg-[rgba(254,254,254,.16)] backdrop-blur-md">
                      <IconoServicio index={i} />
                    </span>
                    <span className="text-[13px] text-[rgba(254,254,254,.8)]">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div>
                    <span className="block max-w-[14ch] text-[clamp(24px,2.2vw,32px)] font-medium leading-[1.02] tracking-[-0.03em]">{titulo}</span>
                    <div className={`grid transition-[grid-template-rows] duration-500 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <p className="max-w-[40ch] pt-3 text-[15px] leading-relaxed text-[rgba(254,254,254,.88)]">{texto}</p>
                      </div>
                    </div>
                    <span
                      className={`mt-4 inline-flex items-center gap-2.5 rounded-[12px] px-3.5 py-2 text-[14px] font-medium transition-colors ${on ? "bg-[#fefefe] text-[#080808]" : "bg-[rgba(254,254,254,.16)] text-[#fefefe]"}`}
                    >
                      Ver servicio
                      <span className={`grid h-6 w-6 place-items-center rounded-lg text-[12px] ${on ? "bg-[#080808] text-[#fefefe]" : "bg-[#fefefe] text-[#080808]"}`}>↗</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="corp-pad flex flex-col items-center gap-[clamp(20px,2.4vw,36px)] py-[clamp(110px,14vw,220px)] pb-[clamp(30px,4vw,60px)] text-center">
        <FillText text={HUMAN_FILL} center className="max-w-[24ch]" />
        <p data-reveal="" aria-label="Humanamente." className="m-0 flex max-w-full justify-center whitespace-nowrap px-2">
          {"HUMAN".split("").map((c, i) => (
            <span key={`${c}${i}`} className="inline-block" style={{ opacity: 0, filter: "blur(14px)", translate: "0 .35em" }}>
              {c}
            </span>
          ))}
          <span data-hm-wrap="" className="relative z-[1] inline-block" style={{ opacity: 0 }}>
            <svg data-hm-a="" viewBox="36.5 36 47 46.5" aria-label="A" className="inline-block h-[0.85em] w-[0.86em] overflow-visible align-[-0.1em]">
              <path d="M39 81L60 39L81 81" fill="none" stroke="#080808" strokeWidth="7" strokeLinejoin="miter" />
              <rect data-hm-bar="" x="6.5" y="80.2" width="22" height="1.6" fill="#080808" style={{ transformBox: "fill-box", transformOrigin: "100% 50%", transform: "scaleX(0)" }} />
              <rect data-hm-bar="" x="91.5" y="80.2" width="22" height="1.6" fill="#080808" style={{ transformBox: "fill-box", transformOrigin: "0% 50%", transform: "scaleX(0)" }} />
            </svg>
          </span>
          {"MENTE.".split("").map((c, i) => (
            <span key={`b${c}${i}`} className="inline-block" style={{ opacity: 0, filter: "blur(14px)", translate: "0 .35em" }}>
              {c}
            </span>
          ))}
        </p>
      </section>

      <section className="corp-inset-x relative flex min-h-[clamp(520px,70vh,760px)] overflow-hidden rounded-[28px] bg-[#080808] text-[#fefefe]">
        <div data-px="" className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/edificio-noche.jpg`} alt="" className="h-full w-full object-cover" style={{ transform: "scale(1.12)" }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,8,.78)] to-[rgba(8,8,8,.25)]" />
        <div className="relative flex flex-1 flex-col justify-between gap-12 p-[clamp(28px,3.4vw,48px)]">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[rgba(254,254,254,.8)]">(05) Nuestro compromiso</p>
          <div className="flex flex-col gap-7">
            <p className="max-w-[18ch] text-[clamp(32px,4.4vw,64px)] font-medium leading-none tracking-[-0.035em]">Donde cada propiedad encuentra su mejor versión.</p>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <p className="max-w-[52ch] text-[16px] leading-relaxed text-[rgba(254,254,254,.85)]">
                Tratamos cada proyecto como si fuera nuestro, porque detrás de cada operación hay ilusiones, proyectos y confianza depositada en nosotros.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Mimo", "Profesionalidad", "Personas"].map((t) => (
                  <span key={t} className="rounded-full border border-[rgba(254,254,254,.35)] px-4 py-2 text-[14px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SeccionDiferenciaRehabinco />

      <section id="reformas" className="corp-pad grid items-start gap-12 pb-0 pt-[clamp(80px,10vw,150px)] md:grid-cols-2 md:gap-20">
        <div className="flex flex-col gap-10">
          <div>
            <p data-enter="0" className="corp-kicker">(07) Reformas</p>
            <h2 className="corp-h2 mt-3">
              <SplitLine name="r1" text="REFORMAS" />
              <SplitLine name="r2" text="LLAVE EN MANO" />
            </h2>
            <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-[#6b6b6b]">
              Reformamos cualquier vivienda o local, lo compres con nosotros o no. Presupuesto cerrado por escrito y fecha de entrega en el contrato.
            </p>
          </div>
          <div className="border-t border-[rgba(8,8,8,.14)]">
            {REFORMAS.map((r, i) => (
              <button
                key={r.titulo}
                type="button"
                className={`flex w-full flex-col gap-2.5 border-b border-[rgba(8,8,8,.14)] py-5 text-left transition-opacity ${reformaActiva === i ? "opacity-100" : "opacity-55"}`}
                onMouseEnter={() => setReformaActiva(i)}
                onClick={() => setReformaActiva(i)}
              >
                <span className="text-[24px] font-medium tracking-[-0.02em]">{r.titulo}</span>
                <span className="max-w-[52ch] text-[15px] leading-relaxed text-[#6b6b6b]">{r.texto}</span>
              </button>
            ))}
            <p className="border-b border-[rgba(8,8,8,.14)] py-5 text-[17px] font-medium tracking-[-0.01em] text-[#6b6b6b]">{REFORMAS_CIERRA}</p>
          </div>
          <Link href="#contacto" className="corp-btn self-start">
            Pide presupuesto de reforma
            <span className="corp-btn-icon">↗</span>
          </Link>
        </div>
        <div data-wipe="" className="relative sticky top-6 max-h-[860px] overflow-hidden rounded-[28px] bg-[#f4f3f1] aspect-[4/5]">
          <div data-wipe-media="" className="absolute inset-0">
          {REFORMAS.map((r, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={r.titulo} src={r.img} alt={r.titulo} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${reformaActiva === i ? "opacity-100" : "opacity-0"}`} />
          ))}
          </div>
        </div>
      </section>

      <section className="corp-band flex w-full min-w-0 flex-col gap-8 bg-[#080808] text-[#fefefe] md:gap-[clamp(40px,5vw,72px)]">
        <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-full">
            <p className="text-[12px] uppercase tracking-[0.06em] text-[#9a9a9a]">(08) Servicio 360°</p>
            <h2 className="corp-h2 mt-3 max-w-full min-w-0">
              <SplitLine name="o1" text="DE LA BÚSQUEDA" />
              <SplitLine name="o2" text="A LAS LLAVES" />
            </h2>
          </div>
          <p className="min-w-0 max-w-[40ch] text-[15px] leading-relaxed text-[#9a9a9a]">
            Compraventa, hipoteca, reforma, suministros y trámites. Todo lo hace el mismo equipo, para que tú solo tengas que elegir.
          </p>
        </div>
        <div className="grid w-full min-w-0 items-start gap-10 lg:grid-cols-2">
          <div data-count-trigger="" className="flex min-w-0 flex-col gap-3.5">
            <div className="flex min-w-0 items-start gap-1 font-medium tabular-nums leading-[0.9] tracking-[-0.045em]">
              <span data-count-value="" className="text-[clamp(72px,22vw,180px)]">0</span>
              <span className="mt-[-0.02em] text-[clamp(44px,12vw,96px)] text-[#c9a27a]">°</span>
            </div>
            <span className="text-[15px]">Servicio integral · Un solo interlocutor</span>
            <span className="text-[13px] text-[#9a9a9a]">Te acompañamos antes, durante y después de la firma</span>
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[rgba(254,254,254,.14)]">
              <div data-count-bar="" className="h-full rounded-full bg-[#c9a27a]" style={{ width: "0%" }} />
            </div>
          </div>
          <div className="min-w-0 border-t border-[rgba(254,254,254,.14)]">
            {FASES_360.map(([titulo, fecha, estado], i) => {
              const opt = estado === "Opcional";
              return (
                <div
                  key={titulo}
                  className="grid grid-cols-1 gap-2 border-b border-[rgba(254,254,254,.14)] py-4 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:gap-3 sm:py-[18px]"
                >
                  <span className="text-[13px] text-[#9a9a9a]">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="text-[18px] font-medium tracking-[-0.01em]">{titulo}</p>
                    <p className="text-[13px] text-[#9a9a9a]">{fecha}</p>
                  </div>
                  <span
                    className={`w-fit rounded-full border px-2.5 py-1.5 text-[12px] uppercase tracking-[0.06em] sm:whitespace-nowrap ${opt ? "border-[rgba(201,162,122,.6)] text-[#c9a27a]" : "border-[rgba(254,254,254,.3)] text-[#fefefe]"}`}
                  >
                    {estado}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <GridFases360 items={UPDATES_360} />
      </section>

      <section id="resenas" className="corp-band flex w-full min-w-0 flex-col gap-8 bg-[#f4f3f1] md:gap-[clamp(40px,5vw,72px)]">
        <div className="flex w-full min-w-0 flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-full">
            <p data-enter="0" className="corp-kicker">(09) Reseñas</p>
            <h2 className="corp-h2 mt-3 max-w-full min-w-0">
              <SplitLine name="s1" text="LO QUE DICEN" />
              <SplitLine name="s2" text="DE NOSOTROS" />
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-[clamp(48px,14vw,88px)] font-medium leading-[0.9] tracking-[-0.05em]">4,9</span>
            <div className="flex flex-col gap-1.5">
              <span className="tracking-wide text-[#c9a27a]">★★★★★</span>
              <span className="text-[13px] text-[#6b6b6b]">Valoración media · 48 reseñas en Google</span>
            </div>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-4 lg:flex-row">
          <div className="relative flex min-h-[320px] w-full min-w-0 flex-col justify-between gap-9 overflow-hidden rounded-[24px] bg-[#fefefe] p-6 sm:min-h-[360px] sm:p-[clamp(28px,3.4vw,52px)] lg:flex-[2]">
            <span aria-hidden className="pointer-events-none absolute right-6 top-2 text-[clamp(140px,16vw,240px)] font-medium leading-none text-[#f4f3f1]">
              ”
            </span>
            <p className="relative max-w-[28ch] text-[clamp(24px,2.6vw,38px)] font-medium leading-[1.15] tracking-[-0.03em]">“{reviewActive.texto}”</p>
            <div className="relative flex w-full min-w-0 flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-[#080808] text-[15px] font-medium text-[#fefefe]">{reviewActive.ini}</span>
                <div>
                  <p className="text-[16px] font-medium">{reviewActive.nombre}</p>
                  <p className="text-[13px] text-[#6b6b6b]">{reviewActive.tipo}</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="flex gap-1.5">
                  {REVIEWS.map((_, i) => (
                    <button key={i} type="button" aria-label={`Reseña ${i + 1}`} className={`h-1.5 rounded-full border-0 p-0 ${review === i ? "w-[26px] bg-[#080808]" : "w-1.5 bg-[rgba(8,8,8,.2)]"}`} onClick={() => setReview(i)} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-[rgba(8,8,8,.14)] bg-[#fefefe]" onClick={() => setReview((r) => (r - 1 + REVIEWS.length) % REVIEWS.length)}>
                    ←
                  </button>
                  <button type="button" className="grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-[#080808] text-[#fefefe]" onClick={() => setReview((r) => (r + 1) % REVIEWS.length)}>
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-4 lg:min-w-[280px] lg:flex-1">
            <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-[24px] bg-[#e9e6e1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${A}/dormitorio.jpg`} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col gap-2.5 rounded-[24px] bg-[#080808] p-6 text-[#fefefe]">
              <span className="text-[clamp(32px,3vw,44px)] font-medium leading-none tracking-[-0.04em]">+150</span>
              <span className="text-[14px] text-[rgba(254,254,254,.8)]">familias que ya han encontrado, vendido o reformado su casa con nosotros</span>
            </div>
          </div>
        </div>
      </section>

      <section className="corp-pad grid items-start gap-10 py-[clamp(80px,10vw,150px)] md:grid-cols-2">
        <div>
          <p data-enter="0" className="corp-kicker">(10) Preguntas</p>
          <h2 className="corp-h2 mt-3">
            <SplitLine name="f1" text="DUDAS" />
            <SplitLine name="f2" text="FRECUENTES" />
          </h2>
        </div>
        <div className="border-t border-[rgba(8,8,8,.14)]">
          {FAQS.map(([q, a], i) => {
            const open = faqAbierta === i;
            return (
              <div key={q} className="border-b border-[rgba(8,8,8,.14)]">
                <button type="button" className="flex w-full items-center justify-between gap-6 py-5 text-left" onClick={() => setFaqAbierta(open ? -1 : i)}>
                  <span className="text-[clamp(17px,1.4vw,20px)] font-medium tracking-[-0.01em]">{q}</span>
                  <span className={`text-lg transition-transform ${open ? "rotate-45" : ""}`}>+</span>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="max-w-[60ch] pb-5 text-[15px] leading-relaxed text-[#6b6b6b]">{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ContactoFooter enDominio={enDominio} />

      {modalServicio >= 0 ? (
        <ModalServicio
          servicio={SERVICIOS_DETALLE[modalServicio]!}
          index={modalServicio}
          total={SERVICIOS_DETALLE.length}
          onClose={() => setModalServicio(-1)}
          onPrev={() => setModalServicio((m) => (m - 1 + SERVICIOS_DETALLE.length) % SERVICIOS_DETALLE.length)}
          onNext={() => setModalServicio((m) => (m + 1) % SERVICIOS_DETALLE.length)}
        />
      ) : null}
    </div>
  );
}
