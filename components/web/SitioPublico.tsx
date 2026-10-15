import Link from "next/link";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { hrefInmueble } from "@/lib/web/dominio";
import { precioPublico, TEMAS_WEB, type InmuebleWeb, type WebPublica } from "@/lib/web/modelo";
import { CabeceraWeb, MarcoWeb, PieWeb } from "./MarcoWeb";

function tipoDe(valor: string | null): string | null {
  if (!valor) return null;
  return valor in TIPO_INMUEBLE_LABEL ? TIPO_INMUEBLE_LABEL[valor as TipoInmueble] : null;
}

function enlaceTelefono(telefono: string): string {
  return `tel:${telefono.replace(/\s/g, "")}`;
}

export function TarjetaInmueble({
  item,
  tema,
  enDominio = false,
  onAbrir,
}: {
  item: InmuebleWeb;
  tema: (typeof TEMAS_WEB)["claro"];
  enDominio?: boolean;
  onAbrir?: () => void;
}) {
  const foto = item.fotos[0];
  const tipo = tipoDe(item.tipo_inmueble);
  const datos = [
    tipo,
    item.superficie_m2 ? `${Math.round(item.superficie_m2)} m²` : null,
    item.habitaciones != null ? `${item.habitaciones} hab.` : null,
    item.banos != null ? `${item.banos} baños` : null,
  ].filter(Boolean);
  const clase = "block w-full overflow-hidden rounded-2xl border text-left";
  const estilo = { background: tema.tarjeta, borderColor: tema.linea };
  const cuerpo = (
    <>
      {foto ? (
        <img src={foto} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full" style={{ background: tema.linea }} />
      )}
      <div className="space-y-1 px-4 py-4">
        <p className="text-[13px]" style={{ color: tema.suave }}>{item.localidad}</p>
        <h3 className="text-[17px] font-semibold leading-snug" style={{ fontFamily: tema.titulo }}>{item.titulo}</h3>
        <p className="text-[15px] font-semibold" style={{ color: tema.acento }}>{precioPublico(item)}</p>
        {datos.length ? <p className="text-[13px]" style={{ color: tema.suave }}>{datos.join(" · ")}</p> : null}
      </div>
    </>
  );
  if (onAbrir) {
    return (
      <button type="button" onClick={onAbrir} className={clase} style={estilo}>
        {cuerpo}
      </button>
    );
  }
  return (
    <Link
      href={hrefInmueble(enDominio, item.referencia)}
      className={clase}
      style={estilo}
    >
      {cuerpo}
    </Link>
  );
}

export function SitioPublico({
  web,
  enDominio = false,
  onAbrirInmueble,
  anclar = false,
}: {
  web: WebPublica;
  enDominio?: boolean;
  onAbrirInmueble?: (referencia: string) => void;
  anclar?: boolean;
}) {
  const tema = TEMAS_WEB[web.sitio.diseno];
  const marca = web.sitio.marca;
  if (!web.sitio.publicado) {
    return (
      <MarcoWeb tema={tema}>
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
          <p className="text-[13px] font-medium" style={{ color: tema.acento }}>{marca.nombre}</p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ fontFamily: tema.titulo }}>La web todavía no está publicada.</h1>
        </main>
      </MarcoWeb>
    );
  }

  return (
    <MarcoWeb tema={tema}>
      {web.bloques.map((bloque) => {
        const c = bloque.contenido;
        if (bloque.tipo === "cabecera") {
          return <CabeceraWeb key={bloque.id} marca={marca} tema={tema} enDominio={enDominio} anclar={anclar} />;
        }
        if (bloque.tipo === "hero") {
          return (
            <section key={bloque.id} className="web-hero mx-auto max-w-6xl px-5 py-8">
              <div>
                <h1 className="text-4xl font-semibold leading-tight" style={{ fontFamily: tema.titulo }}>
                  {c.titulo || marca.nombre}
                </h1>
                {c.subtitulo ? <p className="mt-4 max-w-xl text-[17px] leading-7" style={{ color: tema.suave }}>{c.subtitulo}</p> : null}
              </div>
              {c.imagen_url ? <img src={c.imagen_url} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover" /> : null}
            </section>
          );
        }
        if (bloque.tipo === "texto") {
          return (
            <section key={bloque.id} className="mx-auto max-w-3xl px-5 py-8">
              {c.titulo ? <h2 className="text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo}</h2> : null}
              {c.cuerpo ? <p className="mt-3 whitespace-pre-line text-[16px] leading-7" style={{ color: tema.suave }}>{c.cuerpo}</p> : null}
            </section>
          );
        }
        if (bloque.tipo === "inmuebles") {
          return (
            <section key={bloque.id} id="inmuebles" className="mx-auto max-w-6xl px-5 py-10">
              <h2 className="text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo || "Inmuebles"}</h2>
              {web.inmuebles.length === 0 ? (
                <p className="mt-4 text-[15px]" style={{ color: tema.suave }}>Todavía no hay inmuebles publicados.</p>
              ) : (
                <div className="web-cards mt-6">
                  {web.inmuebles.map((item) => (
                    <TarjetaInmueble
                      key={item.referencia}
                      item={item}
                      tema={tema}
                      enDominio={enDominio}
                      onAbrir={onAbrirInmueble ? () => onAbrirInmueble(item.referencia) : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        }
        if (bloque.tipo === "galeria") {
          if (c.imagenes.length === 0) return null;
          return (
            <section key={bloque.id} className="mx-auto max-w-6xl px-5 py-8">
              {c.titulo ? <h2 className="mb-5 text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo}</h2> : null}
              <div className="web-galeria">
                {c.imagenes.map((foto) => (
                  <img key={foto.url} src={foto.url} alt={foto.alt} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                ))}
              </div>
            </section>
          );
        }
        if (bloque.tipo === "contacto") {
          return (
            <section key={bloque.id} className="mx-auto max-w-3xl px-5 py-10">
              <h2 className="text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo || "Contacto"}</h2>
              {c.texto ? <p className="mt-3 text-[16px] leading-7" style={{ color: tema.suave }}>{c.texto}</p> : null}
              <div className="mt-5 flex flex-col gap-2 text-[15px]">
                {marca.telefono ? <a href={enlaceTelefono(marca.telefono)} style={{ color: tema.acento }}>{marca.telefono}</a> : null}
                {marca.email ? <a href={`mailto:${marca.email}`} style={{ color: tema.acento }}>{marca.email}</a> : null}
              </div>
            </section>
          );
        }
        return <PieWeb key={bloque.id} texto={c.texto} marca={marca} tema={tema} />;
      })}
    </MarcoWeb>
  );
}
