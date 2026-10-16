"use client";

import Link from "next/link";
import type { ServicioDetalle } from "@/lib/web/corporativa/contenido";
import { WA } from "@/lib/web/corporativa/contenido";
import { IconoServicio } from "./IconoMarca";

export function ModalServicio({
  servicio,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  servicio: ServicioDetalle;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const num = String(index + 1).padStart(2, "0");
  const prevTitulo = index > 0 ? servicio : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,8,8,.55)] p-3 backdrop-blur-sm md:p-10" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={servicio.titulo}
        className="grid max-h-[calc(100vh-24px)] w-full max-w-[1120px] overflow-auto rounded-[28px] bg-[#fefefe] shadow-[0_40px_120px_rgba(8,8,8,.35)] md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-h-[260px] bg-[#f4f3f1] md:min-h-[640px]">
          <div className="absolute inset-2 overflow-hidden rounded-[22px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={servicio.img} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="pointer-events-none absolute bottom-6 left-6 flex flex-wrap gap-2">
            {servicio.stats.map(([v, k]) => (
              <div key={k} className="rounded-[14px] bg-[rgba(254,254,254,.92)] px-3.5 py-3 backdrop-blur-md">
                <p className="text-[20px] font-medium tracking-[-0.02em]">{v}</p>
                <p className="text-[12px] text-[#6b6b6b]">{k}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6 p-6 md:p-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#f4f3f1] text-[#080808]">
                <IconoServicio index={index} />
              </span>
              <span className="text-[12px] uppercase tracking-[0.06em] text-[#6b6b6b]">
                Servicio {num} / {String(total).padStart(2, "0")}
              </span>
            </div>
            <button type="button" aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#f4f3f1] text-lg" onClick={onClose}>
              ×
            </button>
          </div>
          <div>
            <h3 className="text-[clamp(32px,3.4vw,48px)] font-medium leading-[0.98] tracking-[-0.035em]">{servicio.titulo}</h3>
            <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed">{servicio.lead}</p>
          </div>
          <div>
            <p className="pb-2 text-[12px] uppercase tracking-[0.06em] text-[#6b6b6b]">Qué hacemos</p>
            {servicio.incluye.map((it) => (
              <div key={it} className="grid grid-cols-[28px_1fr] gap-2.5 border-t border-[rgba(8,8,8,.1)] py-3">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#c9a27a] text-[11px]">✓</span>
                <span className="text-[15px] leading-relaxed">{it}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap gap-2.5 pt-2">
            <Link href="#contacto" className="corp-btn" onClick={onClose}>
              Solicitar este servicio
              <span className="corp-btn-icon">↗</span>
            </Link>
            <a
              href={`https://api.whatsapp.com/send?phone=${WA}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[46px] items-center rounded-[13px] border border-[rgba(8,8,8,.16)] px-[18px] text-[15px] font-medium hover:bg-[#f4f3f1]"
            >
              WhatsApp
            </a>
          </div>
          <div className="flex justify-between border-t border-[rgba(8,8,8,.1)] pt-4 text-[14px] text-[#6b6b6b]">
            <button type="button" className="hover:text-[#080808]" onClick={onPrev}>
              ← Anterior
            </button>
            <button type="button" className="hover:text-[#080808]" onClick={onNext}>
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
