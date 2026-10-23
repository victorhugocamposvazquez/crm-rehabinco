"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ENERGIA, OFICINA, WA } from "@/lib/web/corporativa/contenido";
import { formatoPrecio, similares } from "@/lib/web/corporativa/catalogo";
import type { InmuebleCorporativa } from "@/lib/web/corporativa/types";
import { hrefInicio, hrefPoliticaPrivacidad } from "@/lib/web/dominio";
import { NavCorporativa } from "./NavCorporativa";
import { ContactoFooter } from "./ContactoFooter";
import { TarjetaInmuebleCorporativa } from "./TarjetaInmuebleCorporativa";

function cuotaHipoteca(precio: number, entradaPct: number, anos: number, interesPct: number) {
  const prestamo = precio * (1 - entradaPct / 100);
  const r = interesPct / 100 / 12;
  const n = anos * 12;
  if (r <= 0 || prestamo <= 0) return { cuota: 0, prestamo };
  const cuota = (prestamo * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  return { cuota, prestamo };
}

function fmtEuro(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

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
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [entrada, setEntrada] = useState(20);
  const [anos, setAnos] = useState(25);
  const [interes, setInteres] = useState(3.2);
  const [mapaCargado, setMapaCargado] = useState(false);
  const fotos = item.fotos.length ? item.fotos : item.fotoPrincipal ? [item.fotoPrincipal] : [];
  const parecidos = useMemo(() => similares(catalogo, item), [catalogo, item]);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const wa = `https://api.whatsapp.com/send?phone=${WA}&text=${encodeURIComponent(`Hola. Estoy interesado en hablar del «${item.titulo}».\n${url}`)}`;
  const hipoteca = item.modo === "venta" ? cuotaHipoteca(item.precio, entrada, anos, interes) : null;
  const abrirFinanciacion = () => {
    const pagina = window.location.href;
    const texto = [
      "Hola, Rehabinco. Quiero pedir un estudio de financiación gratuito.",
      "",
      `Me interesa «${item.titulo}»${item.ref ? ` (ref. ${item.ref})` : ""}.`,
      [item.tipo, item.zona, formatoPrecio(item)].filter(Boolean).join(" · "),
      pagina,
      hipoteca
        ? `He mirado una simulación orientativa: entrada ${entrada} %, ${anos} años, interés ${interes.toFixed(1)} %, cuota aproximada ${fmtEuro(hipoteca.cuota)} al mes.`
        : "Me gustaría que me orientéis sobre la financiación de este inmueble.",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://api.whatsapp.com/send?phone=${WA}&text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  };
  const letraEnergia = "D";
  const idxEnergia = ENERGIA.findIndex(([l]) => l === letraEnergia);
  const mapsQ = encodeURIComponent(`${item.zona} A Coruña`);
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${mapsQ}`;
  const amaps = `https://maps.apple.com/?q=${mapsQ}`;

  return (
    <>
      <div className="corp-page bg-[#fefefe] pb-16">
        <section className="relative w-full min-w-0 bg-[#fefefe] pb-2 pt-24 text-[#080808]">
          <NavCorporativa enDominio={enDominio} clara />
          <div className="corp-pad flex w-full min-w-0 flex-col gap-4">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-[#6b6b6b]">
              <Link href={hrefInicio(enDominio)} className="font-medium text-[#080808]">
                ← Volver
              </Link>
              <span className="opacity-50">/</span>
              <span>{item.modo === "venta" ? "Comprar" : "Alquilar"}</span>
              <span className="opacity-50">/</span>
              <span>{item.zona}</span>
              {item.ref ? (
                <>
                  <span className="opacity-50">/</span>
                  <span>{item.ref}</span>
                </>
              ) : null}
            </p>
            <div className="flex w-full min-w-0 flex-wrap items-end justify-between gap-6">
              <div className="flex min-w-0 max-w-[820px] flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-2 text-[12px] font-medium">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f3f1] px-3 py-1.5">
                    <span className="h-[7px] w-[7px] rounded-full bg-[#c9a27a]" />
                    {item.tipo} en {item.modo === "venta" ? "venta" : "alquiler"}
                  </span>
                  {item.estadoLabel ? <span className="rounded-full border border-[rgba(8,8,8,.12)] px-3 py-1.5">{item.estadoLabel}</span> : null}
                </div>
                <h1 className="max-w-full break-words text-[clamp(30px,4.6vw,68px)] font-medium leading-[0.95] tracking-[-0.04em] text-[#080808]">{item.titulo}</h1>
                <p className="text-[15px] text-[#6b6b6b]">{item.zona}</p>
              </div>
              <div className="flex flex-col items-start gap-0.5 md:items-end">
                <p className="text-[clamp(26px,3.4vw,48px)] font-medium tabular-nums leading-[1.05] tracking-[-0.035em] text-[#6b6b6b]">{formatoPrecio(item)}</p>
                {item.m2 > 0 && item.modo === "venta" ? (
                  <p className="text-[13px] text-[#6b6b6b]">{fmtEuro(Math.round(item.precio / item.m2))} / m²</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="corp-pad grid w-full min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
          <div className="min-w-0">
            <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
              {fotos.slice(0, 5).map((foto, i) => (
                <button
                  key={foto + i}
                  type="button"
                  className={`overflow-hidden rounded-[18px] bg-[#e9e6e1] text-left ${i === 0 ? "md:col-span-2 md:row-span-2 md:min-h-[360px]" : "min-h-[96px]"}`}
                  onClick={() => setLightbox(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt="" className="h-full w-full object-cover" fetchPriority={i === 0 ? "high" : "auto"} />
                </button>
              ))}
            </div>

            <section className="mt-10 flex flex-col gap-[18px]">
              <p className="text-[12px] uppercase tracking-[0.06em] text-[#6b6b6b]">(01) Descripción</p>
              {item.descripcionLarga?.length ? (
                <p className="w-full max-w-[min(100%,52ch)] text-[clamp(22px,2vw,28px)] font-medium leading-[1.2] tracking-[-0.025em] text-[#080808]">{item.descripcion}</p>
              ) : null}
              <div className={`flex w-full min-w-0 flex-col gap-3.5 ${desc || !item.descripcionLarga?.length ? "" : "line-clamp-6"}`}>
                {(item.descripcionLarga?.length ? item.descripcionLarga : [item.descripcion]).map((p) => (
                  <p key={p.slice(0, 32)} className="w-full min-w-0 text-pretty text-[16px] font-normal leading-[1.65] text-[#6b6b6b]">
                    {p}
                  </p>
                ))}
              </div>
              {(item.descripcionLarga?.length ?? 0) > 0 ? (
                <button type="button" className="self-start border-b border-[#080808] pb-0.5 text-[14px] font-medium" onClick={() => setDesc((v) => !v)}>
                  {desc ? "Leer menos" : "Leer más"}
                </button>
              ) : null}
            </section>

            <section className="mt-10 flex flex-col gap-4">
              <p className="corp-kicker">(02) Características</p>
              <div className="grid w-full min-w-0 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
                {[
                  ["Referencia", item.ref || item.slug],
                  ["Tipo", item.tipo],
                  ["Superficie", item.m2 ? `${item.m2} m²` : "—"],
                  ["Dormitorios", item.dormitorios ? String(item.dormitorios) : "—"],
                  ["Baños", item.banos ? String(item.banos) : "—"],
                  ["Operación", item.modo === "venta" ? "Venta" : "Alquiler"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1.5 rounded-[14px] bg-[#f4f3f1] px-3.5 py-3">
                    <p className="text-[12px] tracking-[0.04em] text-[#6b6b6b]">{label}</p>
                    <p className="text-[15px] font-medium leading-tight">{value}</p>
                  </div>
                ))}
              </div>
              {item.extras.length ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {item.extras.map((extra) => (
                    <li key={extra} className="inline-flex items-center gap-2 rounded-full bg-[#f4f3f1] px-3.5 py-2 text-[14px]">
                      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#c9a27a] text-[10px]">✓</span>
                      {extra}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="mt-10 flex flex-col gap-4">
              <p className="corp-kicker">(03) Certificado energético</p>
              <div className="flex items-end gap-1">
                {ENERGIA.map(([l, c], i) => {
                  const active = i === (idxEnergia >= 0 ? idxEnergia : 3);
                  const h = 34 + i * 8;
                  return (
                    <div key={l} className="flex flex-1 flex-col items-center gap-2">
                      <span className={`text-[12px] font-medium ${active ? "opacity-100" : "opacity-0"}`}>{active ? "▼" : "·"}</span>
                      <div
                        className="flex w-full items-center justify-center rounded-lg text-[13px] font-semibold text-[#fefefe] transition-opacity"
                        style={{ height: h, background: c, opacity: active ? 1 : 0.28 }}
                      >
                        {l}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[13px] text-[#6b6b6b]">Certificado en trámite. Calificación orientativa; te facilitamos el documento oficial antes de la visita.</p>
            </section>

            {hipoteca ? (
              <section className="mt-10 flex flex-col gap-5 rounded-[24px] bg-[#f4f3f1] p-[clamp(22px,2.6vw,36px)]">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="corp-kicker">(04) Calcula tu hipoteca</p>
                    <p className="text-[15px] text-[#6b6b6b]">Estimación orientativa. Nuestro equipo compara entidades por ti.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[clamp(32px,3.4vw,48px)] font-medium tabular-nums tracking-[-0.035em]">{fmtEuro(hipoteca.cuota)}</p>
                    <p className="text-[13px] text-[#6b6b6b]">al mes · préstamo de {fmtEuro(hipoteca.prestamo)}</p>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <label className="flex flex-col gap-2.5 text-[14px]">
                    <span className="flex justify-between">
                      <span className="text-[#6b6b6b]">Entrada</span>
                      <span className="font-medium">{entrada} %</span>
                    </span>
                    <input type="range" min={10} max={60} step={5} value={entrada} onChange={(e) => setEntrada(Number(e.target.value))} className="corp-range" />
                  </label>
                  <label className="flex flex-col gap-2.5 text-[14px]">
                    <span className="flex justify-between">
                      <span className="text-[#6b6b6b]">Plazo</span>
                      <span className="font-medium">{anos} años</span>
                    </span>
                    <input type="range" min={5} max={40} step={1} value={anos} onChange={(e) => setAnos(Number(e.target.value))} className="corp-range" />
                  </label>
                  <label className="flex flex-col gap-2.5 text-[14px]">
                    <span className="flex justify-between">
                      <span className="text-[#6b6b6b]">Interés</span>
                      <span className="font-medium">{interes.toFixed(1)} %</span>
                    </span>
                    <input type="range" min={1} max={6} step={0.1} value={interes} onChange={(e) => setInteres(Number(e.target.value))} className="corp-range" />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={abrirFinanciacion}
                  className="inline-flex items-center gap-2.5 self-start rounded-[13px] border border-[rgba(8,8,8,.12)] bg-[#f4f3f1] px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-[#ebeae8]"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#25D366] text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </span>
                  Pide estudio de financiación gratuito
                </button>
              </section>
            ) : null}

            <section className="mt-10 flex flex-col gap-4">
              <p className="corp-kicker">(05) Ubicación</p>
              <div className="relative min-h-[240px] overflow-hidden rounded-[24px] bg-[#f4f3f1] aspect-[16/8]">
                {mapaCargado ? (
                  <iframe
                    title="Mapa"
                    className="absolute inset-0 h-full w-full border-0 grayscale-[0.2]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${mapsQ}&output=embed`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setMapaCargado(true)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
                  >
                    <span className="text-[15px] font-medium text-[#080808]">Cargar mapa</span>
                    <span className="max-w-sm text-[13px] leading-relaxed text-[#6b6b6b]">
                      Al cargarlo, Google puede tratar datos técnicos de la petición. Si prefieres, abre el enlace sin incrustar el mapa.
                    </span>
                  </button>
                )}
                <div className="pointer-events-none absolute bottom-4 left-4 max-w-[calc(100%-32px)] rounded-[15px] bg-[#fefefe] p-4 shadow-[0_8px_24px_rgba(8,8,8,.1)]">
                  <p className="text-[16px] font-medium">{item.zona}</p>
                  <p className="text-[13px] text-[#6b6b6b]">Ubicación aproximada · dirección exacta en la visita</p>
                </div>
                <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-1.5">
                  <a
                    href={gmaps}
                    target="_blank"
                    rel="noreferrer"
                    className="corp-link-on-dark inline-flex items-center gap-2 rounded-[13px] bg-[#080808] px-3.5 py-2.5 text-[14px] font-medium shadow-lg"
                  >
                    Google Maps
                  </a>
                  <a
                    href={amaps}
                    target="_blank"
                    rel="noreferrer"
                    className="corp-link-on-light inline-flex items-center gap-2 rounded-[13px] bg-[#fefefe] px-3.5 py-2.5 text-[14px] font-medium shadow-lg hover:bg-[#f4f3f1]"
                  >
                    Apple Maps
                  </a>
                </div>
              </div>
              <p className="text-[13px] text-[#6b6b6b]">
                Oficina Rehabinco: {OFICINA.direccion}, {OFICINA.ciudad} ·{" "}
                <a href={OFICINA.maps} className="underline">
                  Cómo llegar
                </a>
              </p>
            </section>
          </div>

          <aside id="visita" className="min-w-0 w-full lg:sticky lg:top-5">
            <div className="rounded-[24px] border border-[rgba(8,8,8,.1)] bg-[#fefefe] p-[clamp(20px,2.2vw,28px)] shadow-[0_20px_60px_rgba(8,8,8,.06)]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[22px] font-medium tracking-[-0.02em]">Contacta por este inmueble</h2>
                <span className="text-[13px] text-[#6b6b6b]">{item.ref || item.slug}</span>
              </div>
              <div className="mt-4 space-y-3">
                <p className="rounded-[16px] bg-[#f4f3f1] p-4 text-[14px] leading-relaxed">
                  Hola. Estoy interesado en hablar del «{item.titulo}».
                </p>
                <a href={wa} target="_blank" rel="noreferrer" className="corp-btn w-full justify-center bg-[#25D366] !text-white">
                  Enviar WhatsApp
                  <span className="corp-btn-icon !bg-white/20 !text-white">↗</span>
                </a>
                <a href={`mailto:${OFICINA.email}?subject=${encodeURIComponent(item.titulo)}`} className="block text-[14px] text-[#080808] underline underline-offset-2">
                  {OFICINA.email}
                </a>
                <p className="text-[12.5px] leading-relaxed text-[#6b6b6b]">
                  Al abrir WhatsApp, el mensaje lo trata también Meta.{" "}
                  <Link href={hrefPoliticaPrivacidad(enDominio)} className="underline underline-offset-2">
                    Política de privacidad
                  </Link>
                  .
                </p>
              </div>
            </div>
          </aside>
        </div>

        {parecidos.length ? (
          <section className="corp-pad mt-16 w-full min-w-0">
            <h2 className="corp-h2 max-w-full min-w-0 text-[clamp(28px,3vw,40px)]">SIMILARES</h2>
            <div className="mt-6 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {parecidos.map((otro) => (
                <TarjetaInmuebleCorporativa key={otro.slug} item={otro} enDominio={enDominio} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {lightbox !== null && fotos[lightbox] ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,8,8,.9)] p-4" role="presentation" onClick={() => setLightbox(null)}>
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 text-3xl text-[#fefefe]" onClick={() => setLightbox(null)}>
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotos[lightbox]} alt="" className="max-h-[90vh] max-w-full rounded-[18px] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}

      <ContactoFooter enDominio={enDominio} />
    </>
  );
}
