import Link from "next/link";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { hrefInicio } from "@/lib/web/dominio";
import { precioPublico, TEMAS_WEB, type InmuebleWeb, type MarcaWeb, type DisenoWeb } from "@/lib/web/modelo";
import { CabeceraWeb, MarcoWeb, PieWeb } from "./MarcoWeb";

export function FichaPublica({
  diseno,
  marca,
  pie,
  item,
  enDominio = false,
  onVolver,
  onInicio,
}: {
  diseno: DisenoWeb;
  marca: MarcaWeb;
  pie: string;
  item: InmuebleWeb;
  enDominio?: boolean;
  onVolver?: () => void;
  onInicio?: () => void;
}) {
  const tema = TEMAS_WEB[diseno];
  const tipo = item.tipo_inmueble && item.tipo_inmueble in TIPO_INMUEBLE_LABEL
    ? TIPO_INMUEBLE_LABEL[item.tipo_inmueble as TipoInmueble]
    : null;
  const datos = [
    tipo,
    item.superficie_m2 ? `${Math.round(item.superficie_m2)} m²` : null,
    item.habitaciones != null ? `${item.habitaciones} hab.` : null,
    item.banos != null ? `${item.banos} baños` : null,
  ].filter(Boolean);

  return (
    <MarcoWeb tema={tema}>
      <CabeceraWeb marca={marca} tema={tema} enDominio={enDominio} onInicio={onInicio} onInmuebles={onVolver} />
      <main className="mx-auto max-w-4xl px-5 py-6">
        {onVolver ? (
          <button type="button" onClick={onVolver} className="text-[13px] font-medium" style={{ color: tema.acento }}>
            Todos los inmuebles
          </button>
        ) : (
          <Link href={`${hrefInicio(enDominio)}#inmuebles`} className="text-[13px] font-medium" style={{ color: tema.acento }}>
            Todos los inmuebles
          </Link>
        )}
        <p className="mt-4 text-[13px]" style={{ color: tema.suave }}>{item.localidad}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight" style={{ fontFamily: tema.titulo }}>{item.titulo}</h1>
        <p className="mt-3 text-xl font-semibold" style={{ color: tema.acento }}>{precioPublico(item)}</p>
        {datos.length ? <p className="mt-2 text-[14px]" style={{ color: tema.suave }}>{datos.join(" · ")}</p> : null}
        {item.fotos.length ? (
          <div className="mt-6 grid gap-3">
            <img src={item.fotos[0]} alt="" className="aspect-[16/10] w-full rounded-3xl object-cover" />
            {item.fotos.length > 1 ? (
              <div className="grid grid-cols-3 gap-3">
                {item.fotos.slice(1).map((foto) => (
                  <img key={foto} src={foto} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="mt-8 whitespace-pre-line text-[16px] leading-7">{item.descripcion}</p>
        <p className="mt-6 text-[12px]" style={{ color: tema.suave }}>Ref. {item.referencia}</p>
      </main>
      <PieWeb texto={pie} marca={marca} tema={tema} />
    </MarcoWeb>
  );
}
