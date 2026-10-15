"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FichaPublica } from "@/components/web/FichaPublica";
import { SitioPublico } from "@/components/web/SitioPublico";
import {
  cambiarDisenoWeb,
  cambiarVisibleBloque,
  cambiarWebPublicada,
  guardarBloqueWeb,
  guardarDominioWeb,
  moverBloqueWeb,
  quitarFotoBloque,
  subirFotoBloque,
} from "@/lib/actions/web-sitio";
import {
  DISENOS_WEB,
  ETIQUETA_BLOQUE,
  ETIQUETA_DISENO,
  TEMAS_WEB,
  contenidoDe,
  logoMarca,
  vistaPreviaDe,
  type BloqueWeb,
  type ContenidoBloque,
  type EditorWebDatos,
  type WebPublica,
} from "@/lib/web/modelo";

const campo = "mt-1 w-full rounded-lg border border-border bg-[var(--surface)] px-3 py-2 text-sm";

export function EditorWeb({ datos }: { datos: EditorWebDatos }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [dominio, setDominio] = useState(datos.dominio ?? "");
  const [diseno, setDiseno] = useState(datos.diseno);
  const [bloques, setBloques] = useState(datos.bloques);
  const [borradores, setBorradores] = useState<Record<string, ContenidoBloque>>(() =>
    Object.fromEntries(datos.bloques.map((b) => [b.id, b.contenido]))
  );

  useEffect(() => {
    setDominio(datos.dominio ?? "");
    setDiseno(datos.diseno);
    setBloques(datos.bloques);
  }, [datos]);

  useEffect(() => {
    setBorradores((prev) => {
      const next = { ...prev };
      for (const bloque of datos.bloques) {
        const actual = prev[bloque.id] ?? bloque.contenido;
        next[bloque.id] = {
          ...actual,
          imagen_url: bloque.contenido.imagen_url,
          imagen_path: bloque.contenido.imagen_path,
          imagenes: bloque.contenido.imagenes,
        };
      }
      return next;
    });
  }, [datos]);

  const actuar = (trabajo: Promise<{ ok: boolean; error?: string }>, hecho: string) => {
    arrancar(async () => {
      const resultado = await trabajo;
      if (!resultado.ok) {
        toast.error(resultado.error ?? "No se ha podido guardar.");
        router.refresh();
        return;
      }
      toast.success(hecho);
      router.refresh();
    });
  };

  const patch = (id: string, cambio: Partial<ContenidoBloque>) => {
    setBorradores((prev) => ({ ...prev, [id]: { ...(prev[id] ?? contenidoDe(null)), ...cambio } }));
  };

  const vista = vistaPreviaDe({
    diseno,
    marca: { ...datos.marca, logo: logoMarca(diseno, datos.logoClaro, datos.logoOscuro) },
    bloques,
    borradores,
    inmuebles: datos.inmuebles,
  });

  return (
    <div>
      <PageHeader
        title="Web"
        description="La vista previa se actualiza mientras escribes. Guardar deja el cambio en la web."
        actions={
          datos.dominio ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={`https://${datos.dominio}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {datos.dominio}
              </a>
            </Button>
          ) : null
        }
      />

      <div className="mt-6 grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="min-w-0">
      <a href="#vista-web" className="mb-4 inline-flex text-[13px] font-medium text-[var(--accent)] min-[1100px]:hidden">
        Ver la vista previa
      </a>

      <section>
        <h2 className="text-[13px] font-medium text-[var(--text-2)]">Diseño</h2>
        <div className="mt-2 grid gap-2 min-[700px]:grid-cols-3">
          {DISENOS_WEB.map((opcion) => {
            const tema = TEMAS_WEB[opcion];
            const activo = diseno === opcion;
            return (
              <button
                key={opcion}
                type="button"
                disabled={pendiente}
                onClick={() => {
                  if (opcion === diseno) return;
                  setDiseno(opcion);
                  actuar(cambiarDisenoWeb(opcion), "Diseño cambiado.");
                }}
                className="rounded-2xl border p-3 text-left"
                style={{
                  background: tema.fondo,
                  color: tema.tinta,
                  borderColor: activo ? tema.acento : tema.linea,
                  outline: activo ? `2px solid ${tema.acento}` : undefined,
                }}
              >
                <span className="block text-[15px] font-semibold" style={{ fontFamily: tema.titulo }}>{ETIQUETA_DISENO[opcion]}</span>
                <span className="mt-2 block h-2 w-10 rounded-full" style={{ background: tema.acento }} />
              </button>
            );
          })}
        </div>
      </section>

      <label className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-[var(--surface)] px-4 py-3">
        <span>
          <span className="block text-[14px] font-semibold">Web visible</span>
          <span className="text-[12.5px] text-[var(--text-2)]">
            {datos.publicado
              ? datos.dominio
                ? `Quien entre en ${datos.dominio} ve la página.`
                : "Quien entre en /web ve la página."
              : "La página pública dice que aún no está publicada."}
          </span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={datos.publicado}
          disabled={pendiente}
          onChange={(e) => actuar(cambiarWebPublicada(e.target.checked), e.target.checked ? "Web visible." : "Web oculta.")}
        />
      </label>

      <form
        className="mt-3 rounded-2xl border border-border bg-[var(--surface)] px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          actuar(guardarDominioWeb(dominio), dominio.trim() ? "Dominio guardado." : "Dominio quitado.");
        }}
      >
        <Label htmlFor="dominio-web">Dominio de la web</Label>
        <Input
          id="dominio-web"
          value={dominio}
          disabled={pendiente}
          placeholder="web.rehabinco.es"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setDominio(e.target.value)}
          className="mt-1"
        />
        <p className="mt-2 text-[12.5px] text-[var(--text-2)]">
          Puede ser un dominio o un subdominio. El CRM sigue en crm.rehabinco.es. La vista de al lado no depende de este dominio.
        </p>
        <Button type="submit" size="sm" className="mt-3" disabled={pendiente}>
          Guardar dominio
        </Button>
      </form>

      <section className="mt-8 space-y-3">
        {bloques.map((bloque, indice) => (
          <BloqueCard
            key={bloque.id}
            bloque={bloque}
            borrador={borradores[bloque.id] ?? bloque.contenido}
            primero={indice === 0}
            ultimo={indice === bloques.length - 1}
            pendiente={pendiente}
            marca={datos.marca}
            onPatch={(cambio) => patch(bloque.id, cambio)}
            onGuardar={() => actuar(guardarBloqueWeb(bloque.id, borradores[bloque.id] ?? bloque.contenido), "Bloque guardado.")}
            onVisible={(visible) => {
              setBloques((prev) => prev.map((item) => item.id === bloque.id ? { ...item, visible } : item));
              actuar(cambiarVisibleBloque(bloque.id, visible), visible ? "Bloque visible." : "Bloque oculto.");
            }}
            onMover={(direccion) => {
              setBloques((prev) => moverBloque(prev, bloque.id, direccion));
              actuar(moverBloqueWeb(bloque.id, direccion), "Orden cambiado.");
            }}
            onFoto={(archivo) => {
              const datosFoto = new FormData();
              datosFoto.set("foto", archivo);
              const texto = borradores[bloque.id] ?? bloque.contenido;
              actuar(
                (async () => {
                  const guardado = await guardarBloqueWeb(bloque.id, texto);
                  if (!guardado.ok) return guardado;
                  return subirFotoBloque(bloque.id, datosFoto);
                })(),
                "Foto subida.",
              );
            }}
            onQuitar={(path) => actuar(quitarFotoBloque(bloque.id, path), "Foto quitada.")}
          />
        ))}
      </section>
        </div>
        <VistaPrevia web={vista} />
      </div>
    </div>
  );
}

function moverBloque(bloques: BloqueWeb[], id: string, direccion: "arriba" | "abajo"): BloqueWeb[] {
  const indice = bloques.findIndex((bloque) => bloque.id === id);
  const destino = direccion === "arriba" ? indice - 1 : indice + 1;
  if (indice < 0 || destino < 0 || destino >= bloques.length) return bloques;
  const next = bloques.slice();
  const [item] = next.splice(indice, 1);
  if (!item) return bloques;
  next.splice(destino, 0, item);
  return next;
}

function VistaPrevia({ web }: { web: WebPublica }) {
  const [referencia, setReferencia] = useState<string | null>(null);
  const item = referencia ? web.inmuebles.find((inmueble) => inmueble.referencia === referencia) ?? null : null;
  const pie = web.bloques.find((bloque) => bloque.tipo === "pie")?.contenido.texto ?? web.sitio.marca.nombre;

  return (
    <aside id="vista-web" className="order-first min-w-0 scroll-mt-20 min-[1100px]:sticky min-[1100px]:top-[4.5rem] min-[1100px]:order-none">
      <p className="mb-2 text-[13px] font-medium text-[var(--text-2)]">Vista previa</p>
      <div
        data-vista-web
        className="h-[42vh] overflow-auto rounded-2xl border border-border min-[1100px]:h-[calc(100dvh-8rem)]"
      >
        {item ? (
          <FichaPublica
            diseno={web.sitio.diseno}
            marca={web.sitio.marca}
            pie={pie}
            item={item}
            onVolver={() => setReferencia(null)}
            onInicio={() => setReferencia(null)}
          />
        ) : (
          <SitioPublico web={web} anclar onAbrirInmueble={setReferencia} />
        )}
      </div>
    </aside>
  );
}

function BloqueCard({
  bloque,
  borrador,
  primero,
  ultimo,
  pendiente,
  marca,
  onPatch,
  onGuardar,
  onVisible,
  onMover,
  onFoto,
  onQuitar,
}: {
  bloque: BloqueWeb;
  borrador: ContenidoBloque;
  primero: boolean;
  ultimo: boolean;
  pendiente: boolean;
  marca: { nombre: string; telefono: string | null; email: string | null };
  onPatch: (cambio: Partial<ContenidoBloque>) => void;
  onGuardar: () => void;
  onVisible: (visible: boolean) => void;
  onMover: (direccion: "arriba" | "abajo") => void;
  onFoto: (archivo: File) => void;
  onQuitar: (path: string) => void;
}) {
  const tipo = bloque.tipo;
  return (
    <article className="rounded-2xl border border-border bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">{ETIQUETA_BLOQUE[tipo]}</h3>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" disabled={pendiente || primero} aria-label="Subir bloque" onClick={() => onMover("arriba")}>
            <ChevronUp />
          </Button>
          <Button type="button" size="icon" variant="ghost" disabled={pendiente || ultimo} aria-label="Bajar bloque" onClick={() => onMover("abajo")}>
            <ChevronDown />
          </Button>
          <label className="ml-2 flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
            <input type="checkbox" checked={bloque.visible} disabled={pendiente} onChange={(e) => onVisible(e.target.checked)} />
            Visible
          </label>
        </div>
      </div>

      {tipo === "cabecera" ? (
        <p className="mt-3 text-[13px] text-[var(--text-2)]">Usa el nombre y el logo de la marca: {marca.nombre}.</p>
      ) : null}

      {tipo === "hero" || tipo === "texto" || tipo === "inmuebles" || tipo === "galeria" || tipo === "contacto" ? (
        <div className="mt-3">
          <Label htmlFor={`${bloque.id}-titulo`}>Título</Label>
          <Input id={`${bloque.id}-titulo`} className="mt-1" value={borrador.titulo} onChange={(e) => onPatch({ titulo: e.target.value })} />
        </div>
      ) : null}

      {tipo === "hero" ? (
        <div className="mt-3">
          <Label htmlFor={`${bloque.id}-sub`}>Subtítulo</Label>
          <Input id={`${bloque.id}-sub`} className="mt-1" value={borrador.subtitulo} onChange={(e) => onPatch({ subtitulo: e.target.value })} />
          <FotoActual url={borrador.imagen_url} path={borrador.imagen_path} onQuitar={onQuitar} />
          <ElegirFoto disabled={pendiente} onFoto={onFoto} />
        </div>
      ) : null}

      {tipo === "texto" ? (
        <div className="mt-3">
          <Label htmlFor={`${bloque.id}-cuerpo`}>Texto</Label>
          <textarea id={`${bloque.id}-cuerpo`} className={`${campo} min-h-28`} value={borrador.cuerpo} onChange={(e) => onPatch({ cuerpo: e.target.value })} />
        </div>
      ) : null}

      {tipo === "galeria" ? (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-2">
            {borrador.imagenes.map((foto) => (
              <div key={foto.url} className="relative">
                <img src={foto.url} alt={foto.alt} className="aspect-[4/3] w-full rounded-xl object-cover" />
                {foto.path ? (
                  <button type="button" className="absolute right-1 top-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white" onClick={() => onQuitar(foto.path!)}>
                    Quitar
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <ElegirFoto disabled={pendiente} onFoto={onFoto} />
        </div>
      ) : null}

      {tipo === "contacto" ? (
        <div className="mt-3">
          <Label htmlFor={`${bloque.id}-texto`}>Texto</Label>
          <textarea id={`${bloque.id}-texto`} className={`${campo} min-h-20`} value={borrador.texto} onChange={(e) => onPatch({ texto: e.target.value })} />
          <p className="mt-2 text-[12.5px] text-[var(--text-2)]">
            Teléfono y email salen de la marca{marca.telefono || marca.email ? `: ${[marca.telefono, marca.email].filter(Boolean).join(" · ")}` : "."}
          </p>
        </div>
      ) : null}

      {tipo === "pie" ? (
        <div className="mt-3">
          <Label htmlFor={`${bloque.id}-pie`}>Texto</Label>
          <Input id={`${bloque.id}-pie`} className="mt-1" value={borrador.texto} onChange={(e) => onPatch({ texto: e.target.value })} />
        </div>
      ) : null}

      {tipo !== "cabecera" ? (
        <Button type="button" size="sm" className="mt-4" disabled={pendiente} onClick={onGuardar}>
          Guardar bloque
        </Button>
      ) : null}
    </article>
  );
}

function FotoActual({ url, path, onQuitar }: { url: string | null; path: string | null; onQuitar: (path: string) => void }) {
  if (!url) return null;
  return (
    <div className="relative mt-3 max-w-xs">
      <img src={url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
      {path ? (
        <button type="button" className="absolute right-1 top-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white" onClick={() => onQuitar(path)}>
          Quitar
        </button>
      ) : null}
    </div>
  );
}

function ElegirFoto({ disabled, onFoto }: { disabled: boolean; onFoto: (archivo: File) => void }) {
  return (
    <label className="mt-3 inline-flex cursor-pointer text-[13px] font-medium text-[var(--accent)]">
      Subir foto
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) onFoto(archivo);
        }}
      />
    </label>
  );
}
