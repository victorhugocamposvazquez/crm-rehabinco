"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type BloqueWeb,
  type ContenidoBloque,
  type EditorWebDatos,
} from "@/lib/web/modelo";

const campo = "mt-1 w-full rounded-lg border border-border bg-[var(--surface)] px-3 py-2 text-sm";

export function EditorWeb({ datos }: { datos: EditorWebDatos }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [dominio, setDominio] = useState(datos.dominio ?? "");
  const [borradores, setBorradores] = useState<Record<string, ContenidoBloque>>(() =>
    Object.fromEntries(datos.bloques.map((b) => [b.id, b.contenido]))
  );

  useEffect(() => {
    setDominio(datos.dominio ?? "");
  }, [datos.dominio]);

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
        return;
      }
      toast.success(hecho);
      router.refresh();
    });
  };

  const patch = (id: string, cambio: Partial<ContenidoBloque>) => {
    setBorradores((prev) => ({ ...prev, [id]: { ...(prev[id] ?? contenidoDe(null)), ...cambio } }));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Web"
        description="Elige un diseño, cambia los textos y mueve los bloques. Los inmuebles salen de los que marques en su ficha."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href="/web" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Vista previa
              </a>
            </Button>
            {datos.dominio ? (
              <Button variant="secondary" size="sm" asChild>
                <a href={`https://${datos.dominio}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {datos.dominio}
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="mt-6">
        <h2 className="text-[13px] font-medium text-[var(--text-2)]">Diseño</h2>
        <div className="mt-2 grid gap-2 min-[700px]:grid-cols-3">
          {DISENOS_WEB.map((diseno) => {
            const tema = TEMAS_WEB[diseno];
            const activo = datos.diseno === diseno;
            return (
              <button
                key={diseno}
                type="button"
                disabled={pendiente}
                onClick={() => {
                  if (diseno !== datos.diseno) actuar(cambiarDisenoWeb(diseno), "Diseño cambiado.");
                }}
                className="rounded-2xl border p-3 text-left"
                style={{
                  background: tema.fondo,
                  color: tema.tinta,
                  borderColor: activo ? tema.acento : tema.linea,
                  outline: activo ? `2px solid ${tema.acento}` : undefined,
                }}
              >
                <span className="block text-[15px] font-semibold" style={{ fontFamily: tema.titulo }}>{ETIQUETA_DISENO[diseno]}</span>
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
          Puede ser un dominio o un subdominio. El CRM sigue en crm.rehabinco.es. Si lo dejas vacío, la vista previa queda en /web.
        </p>
        <Button type="submit" size="sm" className="mt-3" disabled={pendiente}>
          Guardar dominio
        </Button>
      </form>

      <section className="mt-8 space-y-3">
        {datos.bloques.map((bloque, indice) => (
          <BloqueCard
            key={bloque.id}
            bloque={bloque}
            borrador={borradores[bloque.id] ?? bloque.contenido}
            primero={indice === 0}
            ultimo={indice === datos.bloques.length - 1}
            pendiente={pendiente}
            marca={datos.marca}
            onPatch={(cambio) => patch(bloque.id, cambio)}
            onGuardar={() => actuar(guardarBloqueWeb(bloque.id, borradores[bloque.id] ?? bloque.contenido), "Bloque guardado.")}
            onVisible={(visible) => actuar(cambiarVisibleBloque(bloque.id, visible), visible ? "Bloque visible." : "Bloque oculto.")}
            onMover={(direccion) => actuar(moverBloqueWeb(bloque.id, direccion), "Orden cambiado.")}
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
