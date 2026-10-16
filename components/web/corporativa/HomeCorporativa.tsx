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
  REVIEWS,
  SERVICIOS_DETALLE,
  SERVICIOS_RESUMEN,
  UPDATES_360,
  VENTAJAS,
  ZONAS,
} from "@/lib/web/corporativa/contenido";
import type { InmuebleCorporativa, ModoCorporativa } from "@/lib/web/corporativa/types";
import { hrefInmuebles } from "@/lib/web/dominio";
import { ContactoFooter } from "./ContactoFooter";
import { IconoLetraA, IconoMarcaCompleto, IconoServicio } from "./IconoMarca";
import { ModalServicio } from "./ModalServicio";
import { NavCorporativa } from "./NavCorporativa";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";

const PRECIOS_VENTA = ["Indiferente", "Hasta 150.000 €", "150.000 – 250.000 €", "250.000 – 400.000 €", "400.000 € o más"];
const PRECIOS_ALQ = ["Indiferente", "Hasta 800 €/mes", "800 – 1.200 €/mes", "1.200 €/mes o más"];

function HeroWord() {
  const word = "HOGARES";
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-[clamp(110px,16vh,190px)] z-[2] px-[clamp(16px,2.6vw,40px)]">
      <div className="flex overflow-hidden whitespace-nowrap text-[clamp(60px,19.5vw,330px)] font-medium leading-[0.86] tracking-[-0.055em] text-[#fefefe]">
        {[...word].map((ch, i) =>
          ch === "A" ? (
            <IconoLetraA key={i} className="inline-block h-[0.72em] w-[0.7em] align-baseline" stroke="#fefefe" />
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </div>
      <div className="absolute inset-x-[clamp(16px,2.6vw,40px)] top-0 flex overflow-hidden whitespace-nowrap text-[clamp(60px,19.5vw,330px)] font-medium leading-[0.86] tracking-[-0.055em] text-transparent [-webkit-text-stroke:1px_rgba(254,254,254,.55)]">
        {[...word].map((ch, i) =>
          ch === "A" ? (
            <IconoLetraA key={i} className="inline-block h-[0.72em] w-[0.7em] align-baseline" stroke="rgba(254,254,254,.55)" />
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </div>
    </div>
  );
}

export function HomeCorporativa({ inmuebles, enDominio }: { inmuebles: InmuebleCorporativa[]; enDominio: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoCorporativa>("venta");
  const [busqueda, setBusqueda] = useState("");
  const [ventajaAbierta, setVentajaAbierta] = useState(0);
  const [faqAbierta, setFaqAbierta] = useState(0);
  const [zonaActiva, setZonaActiva] = useState(0);
  const [reformaActiva, setReformaActiva] = useState(0);
  const [servicioHover, setServicioHover] = useState(-1);
  const [modalServicio, setModalServicio] = useState(-1);
  const [review, setReview] = useState(0);
  const [count360, setCount360] = useState(0);
  const countRef = useRef<HTMLDivElement>(null);

  const destacados = useMemo(() => inmuebles.filter((i) => i.modo === modo).slice(0, 3), [inmuebles, modo]);
  const reviewActive = REVIEWS[review] ?? REVIEWS[0]!;
  const zona = ZONAS[zonaActiva] ?? ZONAS[0]!;

  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        let n = 0;
        const step = () => {
          n += 12;
          if (n >= 360) {
            setCount360(360);
            return;
          }
          setCount360(n);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        obs.disconnect();
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const base = hrefInmuebles(enDominio, modo);
    const q = busqueda.trim();
    router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
  };

  return (
    <>
      <header className="relative min-h-[clamp(640px,100vh,1040px)] overflow-hidden bg-[#1b2340] text-[#fefefe]">
        <div className="absolute inset-[-4%_0_0_0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/web/assets/hero-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        </div>
        <HeroWord />
        <div className="pointer-events-none absolute inset-[-4%_0_0_0] z-[1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/web/assets/hero-cutout.png" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[rgba(8,8,8,.72)] to-transparent" />
        <NavCorporativa enDominio={enDominio} />
        <div className="absolute bottom-0 left-0 right-0 z-[4] flex flex-col gap-[clamp(40px,6vh,80px)] px-[clamp(16px,2.6vw,40px)] pb-[clamp(20px,2.6vw,36px)]">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <div className="flex flex-col gap-0.5 text-[clamp(20px,2.3vw,34px)] font-medium leading-[1.05] tracking-[-0.03em] [text-shadow:0_1px_2px_rgba(8,8,8,.55)]">
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
          <form onSubmit={buscar} className="mx-auto flex w-full max-w-[940px] flex-col gap-3">
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
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:gap-12">
          <p className="corp-kicker">(01) Quiénes somos</p>
          <p className="max-w-[26ch] text-[clamp(26px,3.1vw,44px)] font-medium leading-[1.1] tracking-[-0.03em]">{QUIENES_FILL}</p>
        </div>
        <div className="relative -mx-[clamp(16px,2.6vw,40px)] h-[160vh]">
          <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#080808]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${A}/aerea.jpg`} alt="Vista aérea" className="absolute inset-0 h-full w-full scale-[1.18] object-cover" />
            <div className="absolute inset-0 bg-[rgba(8,8,8,.45)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5 text-center text-[#fefefe]">
              <IconoMarcaCompleto className="h-16 w-auto text-[#fefefe] md:h-24" />
              <h2 className="max-w-3xl text-[clamp(44px,7.4vw,124px)] font-medium leading-[0.92] tracking-[-0.045em] [text-shadow:0_2px_40px_rgba(8,8,8,.25)]">
                TU PRÓXIMO HOGAR
                <br />
                EMPIEZA AQUÍ
              </h2>
            </div>
          </div>
        </div>
      </section>

      <section id="pisos" className="relative z-[3] -mt-[18vh] rounded-t-[28px] bg-[#fefefe] px-0 pb-[clamp(40px,5vw,80px)] pt-[clamp(28px,3vw,40px)] shadow-[0_-40px_90px_rgba(8,8,8,.28)]">
        <div className="corp-pad flex justify-center overflow-x-clip py-2">
          <IconoMarcaCompleto className="h-[70px] w-[128px] text-[#080808]" />
        </div>
        <div className="corp-pad flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="corp-kicker">(02) Pisos destacados</p>
            <h2 className="corp-h2 mt-3">
              PISOS
              <br />
              DESTACADOS
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
        <div className="max-h-[860px] overflow-hidden rounded-[28px] bg-[#f4f3f1] aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/salon.jpg`} alt="Salón reformado" className="h-full w-full scale-[1.12] object-cover" />
        </div>
        <div className="flex flex-col gap-10">
          <div>
            <p className="corp-kicker">(03) Te ofrecemos</p>
            <h2 className="corp-h2 mt-3">
              CONFÍA EN
              <br />
              LOS QUE SABEN
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
            <p className="corp-kicker">(04) Servicios</p>
            <h2 className="corp-h2 mt-3">
              SIEMPRE A
              <br />
              TU SERVICIO
            </h2>
          </div>
          <p className="max-w-[48ch] text-[16px] leading-relaxed text-[#6b6b6b]">
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

      <section className="corp-pad flex flex-col items-center gap-6 py-[clamp(110px,14vw,220px)] text-center">
        <p className="max-w-[24ch] text-[clamp(26px,3.1vw,44px)] font-medium leading-[1.12] tracking-[-0.03em]">{HUMAN_FILL}</p>
        <p className="flex flex-wrap justify-center gap-0 text-[clamp(34px,6.4vw,104px)] font-medium leading-[0.9] tracking-[-0.05em]">
          {"HUM".split("").map((c) => (
            <span key={c}>{c}</span>
          ))}
          <IconoLetraA className="relative z-[1] mx-[0.1em] inline-block h-[0.85em] w-[0.86em] align-[-0.1em]" stroke="#080808" />
          {"NMENTE.".split("").map((c, i) => (
            <span key={`${c}${i}`}>{c}</span>
          ))}
        </p>
      </section>

      <section className="relative mx-2 flex min-h-[clamp(520px,70vh,760px)] overflow-hidden rounded-[28px] bg-[#080808] text-[#fefefe] md:mx-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${A}/edificio-noche.jpg`} alt="" className="absolute inset-0 h-full w-full scale-[1.12] object-cover" />
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

      <section id="zonas" className="corp-pad flex flex-col gap-10 pb-0 pt-[clamp(80px,10vw,150px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="corp-kicker">(06) Zonas</p>
            <h2 className="corp-h2 mt-3">ELIGE TU BARRIO</h2>
          </div>
          <p className="max-w-[38ch] text-[15px] leading-relaxed text-[#6b6b6b]">Pasa por un barrio para ver lo que tenemos. Selecciónalo para ver todos sus pisos.</p>
        </div>
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          <div className="border-t border-[rgba(8,8,8,.14)]">
            {ZONAS.map((z, i) => (
              <Link
                key={z.nombre}
                href={`${hrefInmuebles(enDominio, "venta")}?q=${encodeURIComponent(z.nombre.split("–")[0]?.trim() ?? z.nombre)}`}
                className={`grid grid-cols-[44px_1fr_auto] items-baseline gap-3 border-b border-[rgba(8,8,8,.14)] py-5 transition-colors ${zonaActiva === i ? "pl-2.5 text-[#080808]" : "text-[#9a9a9a]"}`}
                onMouseEnter={() => setZonaActiva(i)}
                onFocus={() => setZonaActiva(i)}
              >
                <span className="text-[13px] text-[#9a9a9a]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[clamp(20px,1.8vw,26px)] font-medium tracking-[-0.02em]">{z.nombre}</span>
                <span className="whitespace-nowrap text-[13px] text-[#6b6b6b]">{z.count}</span>
              </Link>
            ))}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-5 text-[13px] text-[#6b6b6b]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#c9a27a]" /> En venta 14
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#080808]" /> En alquiler 9
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#d9d3cb]" /> Reformados este año 16
              </span>
            </div>
          </div>
          <div className="relative min-h-[380px] overflow-hidden rounded-[28px] bg-[#f4f3f1] lg:min-h-[640px]">
            {ZONAS.map((z, i) => (
              <img
                key={z.nombre}
                src={z.img}
                alt={z.nombre}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${zonaActiva === i ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}
              />
            ))}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="inline-flex min-w-[220px] flex-col gap-1.5 rounded-[15px] bg-[#fefefe] p-4">
                <span className="text-[12px] uppercase tracking-[0.06em] text-[#6b6b6b]">
                  {String(zonaActiva + 1).padStart(2, "0")} · Zona
                </span>
                <span className="text-[22px] font-medium tracking-[-0.02em]">{zona.nombre}</span>
                <span className="text-[14px] text-[#6b6b6b]">
                  {zona.count} · desde {zona.desde}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="reformas" className="corp-pad grid items-start gap-12 pb-0 pt-[clamp(80px,10vw,150px)] md:grid-cols-2 md:gap-20">
        <div className="flex flex-col gap-10">
          <div>
            <p className="corp-kicker">(07) Reformas</p>
            <h2 className="corp-h2 mt-3">
              REFORMAS
              <br />
              LLAVE EN MANO
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
          </div>
          <Link href="#contacto" className="corp-btn self-start">
            Pide presupuesto de reforma
            <span className="corp-btn-icon">↗</span>
          </Link>
        </div>
        <div className="relative sticky top-6 max-h-[860px] overflow-hidden rounded-[28px] bg-[#f4f3f1] aspect-[4/5]">
          {REFORMAS.map((r, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={r.titulo} src={r.img} alt={r.titulo} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${reformaActiva === i ? "opacity-100" : "opacity-0"}`} />
          ))}
        </div>
      </section>

      <section ref={countRef} className="mx-2 flex flex-col gap-10 rounded-[28px] bg-[#080808] p-[clamp(56px,7vw,110px)] text-[#fefefe] md:mx-4 md:gap-[clamp(40px,5vw,72px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.06em] text-[#9a9a9a]">(08) Servicio 360°</p>
            <h2 className="mt-3 text-[clamp(36px,4vw,55px)] font-medium leading-[0.95] tracking-[-0.03em]">
              DE LA BÚSQUEDA
              <br />
              A LAS LLAVES
            </h2>
          </div>
          <p className="max-w-[40ch] text-[15px] leading-relaxed text-[#9a9a9a]">
            Compraventa, hipoteca, reforma, suministros y trámites. Todo lo hace el mismo equipo, para que tú solo tengas que elegir.
          </p>
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-1 font-medium tabular-nums leading-[0.9] tracking-[-0.045em]">
              <span className="text-[clamp(96px,12vw,180px)]">{count360}</span>
              <span className="mt-[-0.02em] text-[clamp(56px,6vw,96px)] text-[#c9a27a]">°</span>
            </div>
            <span className="text-[15px]">Servicio integral · Un solo interlocutor</span>
            <span className="text-[13px] text-[#9a9a9a]">Te acompañamos antes, durante y después de la firma</span>
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[rgba(254,254,254,.14)]">
              <div className="h-full rounded-full bg-[#c9a27a]" style={{ width: `${(count360 / 360) * 100}%` }} />
            </div>
          </div>
          <div className="border-t border-[rgba(254,254,254,.14)]">
            {FASES_360.map(([titulo, fecha, estado], i) => {
              const opt = estado === "Opcional";
              return (
                <div key={titulo} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-[rgba(254,254,254,.14)] py-[18px]">
                  <span className="text-[13px] text-[#9a9a9a]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-[18px] font-medium tracking-[-0.01em]">{titulo}</p>
                    <p className="text-[13px] text-[#9a9a9a]">{fecha}</p>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[12px] uppercase tracking-[0.06em] ${opt ? "border-[rgba(201,162,122,.6)] text-[#c9a27a]" : "border-[rgba(254,254,254,.3)] text-[#fefefe]"}`}
                  >
                    {estado}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {UPDATES_360.map((u) => (
            <div key={u.titulo} className="flex flex-col gap-3.5">
              <div className="aspect-[3/2] overflow-hidden rounded-[18px] bg-[#151515]">
                <img src={u.img} alt="" className="h-full w-full object-cover transition-transform hover:scale-[1.03]" />
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-[15px] font-medium">{u.titulo}</span>
                <span className="text-[13px] text-[#9a9a9a]">{u.subtitulo}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="resenas" className="mx-2 mt-[clamp(80px,10vw,150px)] flex flex-col gap-10 rounded-[28px] bg-[#f4f3f1] p-[clamp(56px,7vw,110px)] md:mx-4 md:gap-[clamp(40px,5vw,72px)]">
        <div className="flex flex-wrap items-end justify-between gap-7">
          <div>
            <p className="corp-kicker">(09) Reseñas</p>
            <h2 className="corp-h2 mt-3">
              LO QUE DICEN
              <br />
              DE NOSOTROS
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[clamp(56px,6vw,88px)] font-medium leading-[0.9] tracking-[-0.05em]">4,9</span>
            <div className="flex flex-col gap-1.5">
              <span className="tracking-wide text-[#c9a27a]">★★★★★</span>
              <span className="text-[13px] text-[#6b6b6b]">Valoración media · 48 reseñas en Google</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-4">
          <div className="relative flex min-h-[360px] min-w-0 flex-[2_1_560px] flex-col justify-between gap-9 overflow-hidden rounded-[24px] bg-[#fefefe] p-[clamp(28px,3.4vw,52px)]">
            <span aria-hidden className="pointer-events-none absolute right-6 top-2 text-[clamp(140px,16vw,240px)] font-medium leading-none text-[#f4f3f1]">
              ”
            </span>
            <p className="relative max-w-[28ch] text-[clamp(24px,2.6vw,38px)] font-medium leading-[1.15] tracking-[-0.03em]">“{reviewActive.texto}”</p>
            <div className="relative flex flex-wrap items-center justify-between gap-5">
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
          <div className="flex min-w-[300px] flex-1 flex-col gap-4">
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
          <p className="corp-kicker">(10) Preguntas</p>
          <h2 className="corp-h2 mt-3">
            DUDAS
            <br />
            FRECUENTES
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
    </>
  );
}
