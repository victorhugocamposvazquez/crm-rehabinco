"use client";

import { useState, type MouseEvent } from "react";

type Props = {
  fotos: string[];
  className?: string;
};

export function CarruselFotosTarjeta({ fotos, className }: Props) {
  const [i, setI] = useState(0);
  const n = fotos.length;
  const actual = n ? ((i % n) + n) % n : 0;

  if (!n) {
    return (
      <div className={`grid place-items-center bg-[#e9e6e1] text-sm text-[#6b6b6b] ${className ?? ""}`}>
        Sin foto
      </div>
    );
  }

  const ir = (e: MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setI((prev) => (prev + delta + n) % n);
  };

  return (
    <div className={`relative overflow-hidden bg-[#e9e6e1] ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[actual]}
        alt=""
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loading={actual === 0 ? "eager" : "lazy"}
      />
      {n > 1 ? (
        <>
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-[#080808]/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#fefefe]">
            {n} fotos
          </span>
          <button
            type="button"
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 z-[1] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#fefefe]/92 text-[18px] leading-none text-[#080808] opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
            onClick={(e) => ir(e, -1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 z-[1] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#fefefe]/92 text-[18px] leading-none text-[#080808] opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
            onClick={(e) => ir(e, 1)}
          >
            ›
          </button>
          {n <= 8 ? (
            <div className="pointer-events-none absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1">
              {fotos.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition ${
                    idx === actual ? "w-3 bg-[#fefefe]" : "w-1.5 bg-[#fefefe]/45"
                  }`}
                />
              ))}
            </div>
          ) : (
            <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#080808]/70 px-2 py-0.5 text-[11px] tabular-nums text-[#fefefe]">
              {actual + 1}/{n}
            </span>
          )}
        </>
      ) : null}
    </div>
  );
}
