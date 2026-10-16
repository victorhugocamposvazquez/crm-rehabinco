"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { hrefInicio, hrefInmuebles } from "@/lib/web/dominio";

export function NavCorporativa({ enDominio }: { enDominio: boolean }) {
  const [menu, setMenu] = useState(false);
  const inicio = hrefInicio(enDominio);
  const venta = hrefInmuebles(enDominio, "venta");
  const alquiler = hrefInmuebles(enDominio, "alquiler");

  return (
    <>
      <header className="corp-pad absolute inset-x-0 top-0 z-40 flex items-center justify-between py-5 text-[#fefefe]">
        <Link href={inicio} className="relative z-10 block h-[clamp(30px,2.3vw,38px)] w-[140px]">
          <Image src="/web/assets/rh-logo-blanco.svg" alt="Rehabinco" fill className="object-contain object-left" priority />
        </Link>
        <nav className="hidden items-center gap-7 text-[15px] font-medium md:flex">
          <Link href={venta} className="underline decoration-transparent underline-offset-4 transition hover:decoration-[#fefefe]">
            Inmuebles
          </Link>
          <Link href={`${inicio}#reformas`} className="underline decoration-transparent underline-offset-4 transition hover:decoration-[#fefefe]">
            Reformas
          </Link>
          <Link href={`${inicio}#servicios`} className="underline decoration-transparent underline-offset-4 transition hover:decoration-[#fefefe]">
            Servicios
          </Link>
          <Link href={`${inicio}#servicios`} className="underline decoration-transparent underline-offset-4 transition hover:decoration-[#fefefe]">
            Vende tu inmueble
          </Link>
          <Link href={`${inicio}#contacto`} className="corp-btn !bg-[#fefefe] !text-[#080808]">
            Pide una visita
            <span className="corp-btn-icon !bg-[#080808] !text-[#fefefe]">↗</span>
          </Link>
        </nav>
        <button
          type="button"
          aria-label="Menú"
          className="grid h-11 w-11 place-items-center rounded-[13px] border border-[rgba(254,254,254,.25)] md:hidden"
          onClick={() => setMenu(true)}
        >
          ☰
        </button>
      </header>
      {menu ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#080808] p-6 text-[#fefefe]">
          <div className="flex justify-end">
            <button type="button" aria-label="Cerrar" className="text-2xl" onClick={() => setMenu(false)}>
              ×
            </button>
          </div>
          <div className="mt-8 flex flex-col gap-2 text-[clamp(32px,8vw,40px)] font-medium leading-tight tracking-[-0.035em]">
            <Link href={inicio} onClick={() => setMenu(false)}>
              Inicio
            </Link>
            <Link href={venta} onClick={() => setMenu(false)}>
              Comprar
            </Link>
            <Link href={alquiler} onClick={() => setMenu(false)}>
              Alquilar
            </Link>
            <Link href={`${inicio}#servicios`} onClick={() => setMenu(false)}>
              Servicios
            </Link>
            <Link href={`${inicio}#reformas`} onClick={() => setMenu(false)}>
              Reformas
            </Link>
            <Link href={`${inicio}#servicios`} onClick={() => setMenu(false)}>
              Vende tu inmueble
            </Link>
            <Link href={`${inicio}#contacto`} onClick={() => setMenu(false)}>
              Contacto
            </Link>
          </div>
          <div className="mt-auto flex flex-col gap-2 text-sm text-[#9a9a9a]">
            <a href="tel:+34664859306">664 859 306</a>
            <a href="mailto:oficina@rehabinco.com">oficina@rehabinco.com</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
