import Image from "next/image";
import Link from "next/link";
import { hrefInicio, hrefInmuebles } from "@/lib/web/dominio";

export function PieCorporativa({ enDominio }: { enDominio: boolean }) {
  const inicio = hrefInicio(enDominio);
  return (
    <footer id="contacto" className="mt-24 bg-[#080808] text-[#fefefe]">
      <div className="corp-pad grid gap-12 py-16 md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <p className="corp-kicker !text-[rgba(254,254,254,.55)]">Contacto</p>
          <h2 className="text-[clamp(28px,4vw,44px)] font-medium tracking-[-0.03em]">Cuéntanos qué buscas</h2>
          <p className="max-w-md text-[15px] leading-relaxed text-[rgba(254,254,254,.78)]">
            Comprar, alquilar, vender o reformar. Te respondemos desde la oficina en A Coruña.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[14px]">
            <a href="tel:+34664859306" className="rounded-full border border-[rgba(254,254,254,.2)] px-4 py-2">
              664 859 306
            </a>
            <a
              href="https://api.whatsapp.com/send?phone=34664859306&text=Hola%2C%20me%20gustar%C3%ADa%20hablar%20con%20Rehabinco."
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#fefefe] px-4 py-2 text-[#080808]"
            >
              WhatsApp
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-3 text-[14px] text-[rgba(254,254,254,.72)]">
          <Link href={hrefInmuebles(enDominio, "venta")}>Inmuebles en venta</Link>
          <Link href={hrefInmuebles(enDominio, "alquiler")}>Inmuebles en alquiler</Link>
          <Link href={`${inicio}#servicios`}>Servicios</Link>
          <a href="mailto:oficina@rehabinco.com">oficina@rehabinco.com</a>
        </div>
      </div>
      <div className="corp-pad border-t border-[rgba(254,254,254,.12)] py-10">
        <div className="relative mx-auto h-12 w-[min(280px,70vw)] opacity-90">
          <Image src="/web/assets/rh-logo-blanco.svg" alt="" fill className="object-contain" />
        </div>
        <p className="mt-4 text-center text-[12px] text-[rgba(254,254,254,.45)]">© {new Date().getFullYear()} Rehabinco · A Coruña y Mallorca</p>
      </div>
    </footer>
  );
}
