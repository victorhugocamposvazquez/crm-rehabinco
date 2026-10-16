import Link from "next/link";
import { formatoPrecio, specsCortas } from "@/lib/web/corporativa/catalogo";
import type { InmuebleCorporativa } from "@/lib/web/corporativa/types";
import { hrefInmueble } from "@/lib/web/dominio";

export function TarjetaInmuebleCorporativa({
  item,
  enDominio,
  lista = false,
}: {
  item: InmuebleCorporativa;
  enDominio: boolean;
  lista?: boolean;
}) {
  const href = hrefInmueble(enDominio, item.slug);
  const badge = item.origen === "crm" ? "En stock" : null;
  return (
    <Link
      href={href}
      className={`group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[18px] bg-[#fefefe] ${lista ? "md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-6" : ""}`}
    >
      <div className={`relative overflow-hidden rounded-[18px] bg-[#e9e6e1] ${lista ? "aspect-square md:aspect-[4/3]" : "aspect-[4/3]"}`}>
        {item.fotoPrincipal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.fotoPrincipal} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-[#6b6b6b]">Sin foto</div>
        )}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-[#080808] px-2.5 py-1 text-[11px] font-medium text-[#fefefe]">{badge}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 py-2 md:py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[18px] font-medium tabular-nums text-[#6b6b6b]">{formatoPrecio(item)}</p>
          <span className="text-[12px] text-[#6b6b6b]">{item.tipo}</span>
        </div>
        <h3 className="text-[17px] font-medium leading-snug tracking-[-0.01em]">{item.titulo}</h3>
        <p className="text-[13px] text-[#6b6b6b]">{item.zona}</p>
        {specsCortas(item) ? <p className="text-[13px] text-[#6b6b6b]">{specsCortas(item)}</p> : null}
        {lista ? <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[#6b6b6b]">{item.descripcion}</p> : null}
        {lista ? <span className="mt-3 text-[14px] font-medium underline decoration-[rgba(8,8,8,.25)]">Ver detalle</span> : null}
      </div>
    </Link>
  );
}
