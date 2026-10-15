"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { FichaPublica } from "@/components/web/FichaPublica";
import type { EdicionSitio } from "@/components/web/EdicionBloque";
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
  ETIQUETA_DISENO,
  TEMAS_WEB,
  contenidoDe,
  logoMarca,
  vistaPreviaDe,
  type BloqueWeb,
  type ContenidoBloque,
  type EditorWebDatos,
} from "@/lib/web/modelo";
import { cn } from "@/lib/utils";

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

function contenidoIgual(a: ContenidoBloque, b: ContenidoBloque): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function EditorWeb({ datos }: { datos: EditorWebDatos }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [dominio, setDominio] = useState(datos.dominio ?? "");
  const [diseno, setDiseno] = useState(datos.diseno);
  const [bloques, setBloques] = useState(datos.bloques);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [referencia, setReferencia] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState(false);
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

  const vista = vistaPreviaDe(
    {
      diseno,
      marca: { ...datos.marca, logo: logoMarca(diseno, datos.logoClaro, datos.logoOscuro) },
      bloques,
      borradores,
      inmuebles: datos.inmuebles,
    },
    { editor: true }
  );

  const sucio = useMemo(
    () =>
      bloques.some((bloque) => {
        if (bloque.tipo === "cabecera") return false;
        const borrador = borradores[bloque.id] ?? bloque.contenido;
        return !contenidoIgual(borrador, bloque.contenido);
      }),
    [bloques, borradores]
  );

  const item = referencia ? vista.inmuebles.find((inmueble) => inmueble.referencia === referencia) ?? null : null;
  const pie = vista.bloques.find((bloque) => bloque.tipo === "pie")?.contenido.texto ?? vista.sitio.marca.nombre;

  const edicion: EdicionSitio = {
    bloques,
    seleccionado,
    pendiente,
    onSeleccionar: setSeleccionado,
    onPatch: patch,
    onMover: (id, direccion) => {
      setBloques((prev) => moverBloque(prev, id, direccion));
      actuar(moverBloqueWeb(id, direccion), "Orden cambiado.");
    },
    onVisible: (id, visible) => {
      setBloques((prev) => prev.map((item) => (item.id === id ? { ...item, visible } : item)));
      actuar(cambiarVisibleBloque(id, visible), visible ? "Bloque visible." : "Bloque oculto.");
    },
    onFoto: (id, archivo) => {
      const datosFoto = new FormData();
      datosFoto.set("foto", archivo);
      const texto = borradores[id] ?? bloques.find((b) => b.id === id)?.contenido ?? contenidoDe(null);
      actuar(
        (async () => {
          const guardado = await guardarBloqueWeb(id, texto);
          if (!guardado.ok) return guardado;
          return subirFotoBloque(id, datosFoto);
        })(),
        "Foto subida."
      );
    },
    onQuitarFoto: (id, path) => actuar(quitarFotoBloque(id, path), "Foto quitada."),
  };

  const guardarCambios = () => {
    arrancar(async () => {
      for (const bloque of bloques) {
        if (bloque.tipo === "cabecera") continue;
        const borrador = borradores[bloque.id] ?? bloque.contenido;
        if (contenidoIgual(borrador, bloque.contenido)) continue;
        const resultado = await guardarBloqueWeb(bloque.id, borrador);
        if (!resultado.ok) {
          toast.error(resultado.error ?? "No se ha podido guardar.");
          router.refresh();
          return;
        }
      }
      toast.success("Cambios guardados.");
      router.refresh();
    });
  };

  return (
    <div
      className="-mx-3.5 -mt-5 flex min-h-[calc(100dvh-4rem)] flex-col min-[820px]:-mx-6 min-[820px]:-mt-6"
      onClick={() => setSeleccionado(null)}
    >
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-[var(--surface)] px-3 py-2.5 min-[820px]:px-4">
        <p className="text-[15px] font-semibold">Diseño Web</p>
        <div className="flex flex-wrap gap-1.5">
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
                className={cn("rounded-full border px-3 py-1 text-[12px] font-medium transition-colors", activo && "ring-2 ring-[var(--accent)]")}
                style={{
                  background: tema.fondo,
                  color: tema.tinta,
                  borderColor: activo ? tema.acento : tema.linea,
                }}
              >
                {ETIQUETA_DISENO[opcion]}
              </button>
            );
          })}
        </div>
        <p className="hidden text-[12px] text-[var(--text-2)] min-[900px]:block">Edita sobre la página. Guarda cuando termines.</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-2)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={datos.publicado}
              disabled={pendiente}
              onChange={(e) => actuar(cambiarWebPublicada(e.target.checked), e.target.checked ? "Web visible." : "Web oculta.")}
            />
            Web visible
          </label>
          <Button type="button" size="sm" variant="secondary" disabled={pendiente} onClick={() => setAjustes(true)}>
            <Settings2 className="h-4 w-4" />
            Ajustes
          </Button>
          {datos.dominio ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={`https://${datos.dominio}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir
              </a>
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={pendiente || !sucio} onClick={guardarCambios}>
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </header>

      <div className="relative flex-1 overflow-auto bg-[var(--background)]" data-vista-web>
        {item ? (
          <FichaPublica
            diseno={vista.sitio.diseno}
            marca={vista.sitio.marca}
            pie={pie}
            item={item}
            onVolver={() => setReferencia(null)}
            onInicio={() => setReferencia(null)}
          />
        ) : (
          <SitioPublico web={vista} edicion={edicion} anclar onAbrirInmueble={setReferencia} />
        )}
      </div>

      <Sheet open={ajustes} onOpenChange={setAjustes} variant="side" side="right" showCloseButton>
        <div className="h-full overflow-y-auto px-5 pb-8 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))]">
          <h2 className="text-lg font-semibold">Ajustes de la web</h2>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              actuar(guardarDominioWeb(dominio), dominio.trim() ? "Dominio guardado." : "Dominio quitado.");
              setAjustes(false);
            }}
          >
            <div>
              <Label htmlFor="dominio-web">Dominio público</Label>
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
              <p className="mt-2 text-[12px] text-[var(--text-2)]">
                Subdominio o dominio propio. El CRM sigue en crm.rehabinco.es.
              </p>
            </div>
            <Button type="submit" disabled={pendiente}>
              Guardar dominio
            </Button>
          </form>
        </div>
      </Sheet>
    </div>
  );
}
