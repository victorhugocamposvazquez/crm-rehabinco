import Link from "next/link";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { hrefInmueble } from "@/lib/web/dominio";
import { precioPublico, TEMAS_WEB, type InmuebleWeb, type WebPublica } from "@/lib/web/modelo";
import { EditableText } from "./EditableText";
import { BotonQuitarFoto, EdicionBloque, type EdicionSitio } from "./EdicionBloque";
import { CabeceraWeb, lineaContactoMarca, MarcoWeb, PieWeb } from "./MarcoWeb";

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
    <Link href={hrefInmueble(enDominio, item.referencia)} className={clase} style={estilo}>
      {cuerpo}
    </Link>
  );
}

function envuelve(
  bloque: WebPublica["bloques"][number],
  edicion: EdicionSitio | undefined,
  children: React.ReactNode,
  permiteFoto?: boolean
) {
  if (!edicion) return children;
  return (
    <EdicionBloque bloque={bloque} edicion={edicion} permiteFoto={permiteFoto}>
      {children}
    </EdicionBloque>
  );
}

export function SitioPublico({
  web,
  enDominio = false,
  onAbrirInmueble,
  anclar = false,
  edicion,
}: {
  web: WebPublica;
  enDominio?: boolean;
  onAbrirInmueble?: (referencia: string) => void;
  anclar?: boolean;
  edicion?: EdicionSitio;
}) {
  const tema = TEMAS_WEB[web.sitio.diseno];
  const marca = web.sitio.marca;
  if (!web.sitio.publicado && !edicion) {
    return (
      <MarcoWeb tema={tema}>
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
          <p className="text-[13px] font-medium" style={{ color: tema.acento }}>{marca.nombre}</p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ fontFamily: tema.titulo }}>La web todavía no está publicada.</h1>
        </main>
      </MarcoWeb>
    );
  }

  const patch = (id: string, campo: keyof typeof web.bloques[0]["contenido"], valor: string) => {
    edicion?.onPatch(id, { [campo]: valor });
  };

  return (
    <MarcoWeb tema={tema}>
      {web.bloques.map((bloque) => {
        const c = bloque.contenido;
        if (bloque.tipo === "cabecera") {
          return (
            <div key={bloque.id}>
              {envuelve(
                bloque,
                edicion,
                <>
                  <CabeceraWeb marca={marca} tema={tema} enDominio={enDominio} anclar={anclar} />
                  {edicion ? (
                    <p className="mx-auto max-w-6xl px-5 pb-3 text-[12px]" style={{ color: tema.suave }}>
                      Nombre y logo de {marca.nombre} (ajustes de empresa).
                    </p>
                  ) : null}
                </>
              )}
            </div>
          );
        }
        if (bloque.tipo === "hero") {
          return (
            <div key={bloque.id}>
              {envuelve(
                bloque,
                edicion,
                <section className="web-hero mx-auto max-w-6xl px-5 py-8">
                  <div>
                    {edicion ? (
                      <>
                        <EditableText
                          value={c.titulo}
                          placeholder={marca.nombre}
                          onChange={(valor) => patch(bloque.id, "titulo", valor)}
                          className="text-4xl font-semibold leading-tight"
                          style={{ fontFamily: tema.titulo }}
                        />
                        <EditableText
                          value={c.subtitulo}
                          placeholder="Subtítulo de la portada"
                          onChange={(valor) => patch(bloque.id, "subtitulo", valor)}
                          className="mt-4 max-w-xl text-[17px] leading-7"
                          style={{ color: tema.suave }}
                          multiline
                        />
                      </>
                    ) : (
                      <>
                        <h1 className="text-4xl font-semibold leading-tight" style={{ fontFamily: tema.titulo }}>
                          {c.titulo || marca.nombre}
                        </h1>
                        {c.subtitulo ? <p className="mt-4 max-w-xl text-[17px] leading-7" style={{ color: tema.suave }}>{c.subtitulo}</p> : null}
                      </>
                    )}
                  </div>
                  <div className="relative">
                    {c.imagen_url ? (
                      <img src={c.imagen_url} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover" />
                    ) : edicion ? (
                      <div
                        className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl border border-dashed text-[14px]"
                        style={{ borderColor: tema.linea, color: tema.suave }}
                      >
                        Sube una foto desde la barra del bloque
                      </div>
                    ) : null}
                    {edicion && c.imagen_path ? (
                      <BotonQuitarFoto
                        path={c.imagen_path}
                        disabled={edicion.pendiente}
                        onQuitar={() => edicion.onQuitarFoto(bloque.id, c.imagen_path!)}
                      />
                    ) : null}
                  </div>
                </section>,
                true
              )}
            </div>
          );
        }
        if (bloque.tipo === "texto") {
          return (
            <div key={bloque.id}>
              {envuelve(
                bloque,
                edicion,
                <section className="mx-auto max-w-3xl px-5 py-8">
                  {edicion ? (
                    <>
                      <EditableText
                        value={c.titulo}
                        placeholder="Título"
                        onChange={(valor) => patch(bloque.id, "titulo", valor)}
                        className="text-2xl font-semibold"
                        style={{ fontFamily: tema.titulo }}
                      />
                      <EditableText
                        value={c.cuerpo}
                        placeholder="Texto del bloque"
                        onChange={(valor) => patch(bloque.id, "cuerpo", valor)}
                        className="mt-3 text-[16px] leading-7"
                        style={{ color: tema.suave }}
                        multiline
                      />
                    </>
                  ) : (
                    <>
                      {c.titulo ? <h2 className="text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo}</h2> : null}
                      {c.cuerpo ? <p className="mt-3 whitespace-pre-line text-[16px] leading-7" style={{ color: tema.suave }}>{c.cuerpo}</p> : null}
                    </>
                  )}
                </section>
              )}
            </div>
          );
        }
        if (bloque.tipo === "inmuebles") {
          return (
            <div key={bloque.id}>
              {envuelve(
                bloque,
                edicion,
                <section id="inmuebles" className="mx-auto max-w-6xl px-5 py-10">
                  {edicion ? (
                    <EditableText
                      value={c.titulo}
                      placeholder="Inmuebles"
                      onChange={(valor) => patch(bloque.id, "titulo", valor)}
                      className="text-2xl font-semibold"
                      style={{ fontFamily: tema.titulo }}
                    />
                  ) : (
                    <h2 className="text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo || "Inmuebles"}</h2>
                  )}
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
                  {edicion ? (
                    <p className="mt-4 text-[12px]" style={{ color: tema.suave }}>
                      El listado sale de los inmuebles marcados para la web en su ficha.
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          );
        }
        if (bloque.tipo === "galeria") {
          if (!edicion && c.imagenes.length === 0) return null;
          return (
            <div key={bloque.id}>
              {envuelve(
                bloque,
                edicion,
                <section className="mx-auto max-w-6xl px-5 py-8">
                  {edicion ? (
                    <EditableText
                      value={c.titulo}
                      placeholder="Título de la galería"
                      onChange={(valor) => patch(bloque.id, "titulo", valor)}
                      className="mb-5 text-2xl font-semibold"
                      style={{ fontFamily: tema.titulo }}
                    />
                  ) : c.titulo ? (
                    <h2 className="mb-5 text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo}</h2>
                  ) : null}
                  {c.imagenes.length === 0 && edicion ? (
                    <p className="text-[14px]" style={{ color: tema.suave }}>Añade fotos con el botón Foto del bloque.</p>
                  ) : (
                    <div className="web-galeria">
                      {c.imagenes.map((foto) => (
                        <div key={foto.url} className="relative">
                          <img src={foto.url} alt={foto.alt} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                          {edicion && foto.path ? (
                            <BotonQuitarFoto
                              path={foto.path}
                              disabled={edicion.pendiente}
                              onQuitar={() => edicion.onQuitarFoto(bloque.id, foto.path!)}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>,
                true
              )}
            </div>
          );
        }
        if (bloque.tipo === "contacto") {
          return (
            <div key={bloque.id}>
              {envuelve(
                bloque,
                edicion,
                <section className="mx-auto max-w-3xl px-5 py-10">
                  {edicion ? (
                    <>
                      <EditableText
                        value={c.titulo}
                        placeholder="Contacto"
                        onChange={(valor) => patch(bloque.id, "titulo", valor)}
                        className="text-2xl font-semibold"
                        style={{ fontFamily: tema.titulo }}
                      />
                      <EditableText
                        value={c.texto}
                        placeholder="Texto de contacto"
                        onChange={(valor) => patch(bloque.id, "texto", valor)}
                        className="mt-3 text-[16px] leading-7"
                        style={{ color: tema.suave }}
                        multiline
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-semibold" style={{ fontFamily: tema.titulo }}>{c.titulo || "Contacto"}</h2>
                      {c.texto ? <p className="mt-3 text-[16px] leading-7" style={{ color: tema.suave }}>{c.texto}</p> : null}
                    </>
                  )}
                  <div className="mt-5 flex flex-col gap-2 text-[15px]">
                    {/rehabinco/i.test(marca.nombre) ? <p>CIF {EMPRESA_DOCUMENTOS.cif}</p> : null}
                    {marca.telefono ? <a href={enlaceTelefono(marca.telefono)} style={{ color: tema.acento }}>{marca.telefono}</a> : null}
                    {marca.email ? <a href={`mailto:${marca.email}`} style={{ color: tema.acento }}>{marca.email}</a> : null}
                  </div>
                  {edicion ? (
                    <p className="mt-3 text-[12px]" style={{ color: tema.suave }}>
                      Teléfono y email salen de la marca de la agencia.
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          );
        }
        return (
          <div key={bloque.id}>
            {envuelve(
              bloque,
              edicion,
              edicion ? (
                <footer className="mt-16 border-t px-5 py-8" style={{ borderColor: tema.linea }}>
                  <div className="mx-auto max-w-6xl">
                    <EditableText
                      value={c.texto}
                      placeholder={marca.nombre}
                      onChange={(valor) => patch(bloque.id, "texto", valor)}
                      className="text-[13px]"
                      style={{ color: tema.tinta }}
                    />
                    <p className="mt-2 text-[13px]" style={{ color: tema.suave }}>
                      {lineaContactoMarca(marca)}
                    </p>
                  </div>
                </footer>
              ) : (
                <PieWeb texto={c.texto} marca={marca} tema={tema} />
              )
            )}
          </div>
        );
      })}
    </MarcoWeb>
  );
}
