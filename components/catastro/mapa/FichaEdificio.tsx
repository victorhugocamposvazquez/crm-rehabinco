"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, FileSearch, Home, Loader2, MapPin } from "lucide-react";
import {
  direccionPrincipal,
  etiquetaInmueble,
  ETIQUETA_USO,
  nombreVia,
  type EdificioMapa,
  type InmuebleEdificio,
} from "@/lib/catastro/mapa/inspire";
import { tieneDivisionHorizontal } from "@/lib/catastro/mapa/filtros";

type Carga = { tipo: "cargando" } | { tipo: "ok"; inmuebles: InmuebleEdificio[] } | { tipo: "error"; mensaje: string };

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[12px] text-[var(--text-2)]">{label}</div>
      <div className="text-[15px] tabular-nums">{valor}</div>
    </div>
  );
}

/** Ficha del edificio: foto de fachada, datos, portales, inmuebles y marca de trabajado. */
export function FichaEdificio({
  edificio: e,
  trabajado,
  onMarcar,
  onCerrar,
}: {
  edificio: EdificioMapa;
  trabajado: boolean;
  onMarcar: (trabajado: boolean) => void;
  onCerrar: () => void;
}) {
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const [verTodos, setVerTodos] = useState(false);
  const [sinFoto, setSinFoto] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setCarga({ tipo: "cargando" });
    setVerTodos(false);
    setSinFoto(false);
    fetch(`/api/catastro/mapa/inmuebles?ref=${e.ref}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = (await r.json()) as { ok: boolean; inmuebles?: InmuebleEdificio[]; error?: string };
        if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
        setCarga({ tipo: "ok", inmuebles: j.inmuebles ?? [] });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCarga({ tipo: "error", mensaje: err instanceof Error ? err.message : String(err) });
      });
    return () => ctrl.abort();
  }, [e.ref]);

  const sede = `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${e.ref.slice(0, 7)}&rc2=${e.ref.slice(7)}`;
  const inmuebles = carga.tipo === "ok" ? carga.inmuebles : [];
  const mostrados = verTodos ? inmuebles : inmuebles.slice(0, 8);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)]" data-testid="ficha-edificio">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <button type="button" onClick={onCerrar} className="inline-flex h-9 items-center gap-1.5 rounded-[6px] px-2 text-sm text-[var(--text-2)] hover:bg-[var(--accent-soft)] hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a la lista
        </button>
      </div>

      <div className="space-y-4 p-4">
        <section className="aire-panel flex gap-4 p-4">
          {!sinFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={e.fotoUrl}
              alt="Fachada (Catastro)"
              className="h-[120px] w-[110px] shrink-0 rounded-[6px] bg-[var(--accent-soft)] object-cover"
              onError={() => setSinFoto(true)}
            />
          ) : (
            <div className="grid h-[120px] w-[110px] shrink-0 place-items-center rounded-[6px] bg-[var(--accent-soft)] text-[var(--text-3)]">
              <Home className="h-6 w-6" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-[var(--titulo,var(--foreground))]">{direccionPrincipal(e)}</h2>
            <p className="mb-2 text-[12px] tabular-nums text-[var(--text-2)]">{e.ref}</p>
            <span className={tieneDivisionHorizontal(e) ? "rounded-[6px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-sm" : "rounded-[6px] bg-[var(--amber-bg)] px-1.5 py-0.5 text-sm text-[var(--amber-ink)]"}>
              {tieneDivisionHorizontal(e) ? "División horizontal" : "Sin división horizontal"}
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onMarcar(!trabajado)}
                aria-pressed={trabajado}
                className={
                  trabajado
                    ? "inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--green-bg)] px-3 text-sm text-[var(--green)]"
                    : "inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 text-sm text-[var(--accent-foreground)] hover:bg-[var(--accent-dark)]"
                }
              >
                <Check className="h-4 w-4" aria-hidden />
                {trabajado ? "Trabajado" : "Marcar como trabajado"}
              </button>
              <a
                href={sede}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm hover:bg-[var(--accent-soft)]"
              >
                Sede del Catastro <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <Link
                href={`/notas-simples/nueva?ref=${e.ref}&direccion=${encodeURIComponent(direccionPrincipal(e))}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm hover:bg-[var(--accent-soft)]"
              >
                <FileSearch className="h-3.5 w-3.5" aria-hidden /> Pedir nota simple
              </Link>
            </div>
          </div>
        </section>

        <section className="aire-panel">
          <h3 className="aire-panel-cabecera">Datos del edificio</h3>
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
            <Dato label="Uso principal" valor={ETIQUETA_USO[e.uso]} />
            <Dato label="Año de construcción" valor={e.anio ? String(e.anio) : "—"} />
            <Dato label="Inmuebles" valor={e.inmuebles != null ? String(e.inmuebles) : "—"} />
            <Dato label="Viviendas" valor={e.viviendas != null ? String(e.viviendas) : "—"} />
            <Dato label="Sup. construida" valor={e.superficie != null ? `${e.superficie.toLocaleString("es-ES")} m²` : "—"} />
            <Dato label="Plantas sobre rasante" valor={e.plantas != null ? String(e.plantas) : "—"} />
          </div>
        </section>

        {e.direcciones.length ? (
          <section className="aire-panel">
            <h3 className="aire-panel-cabecera">Portales ({e.direcciones.length})</h3>
            <ul className="divide-y divide-[var(--border)]">
              {e.direcciones.map((d) => (
                <li key={`${d.via}-${d.numero}`} className="flex items-center gap-2 px-4 py-2.5 text-[14px]">
                  <MapPin className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
                  <span className="flex-1">{nombreVia(d.via)}, {d.numero}</span>
                  <span className="text-[12px] text-[var(--text-2)]">{d.codigoPostal ?? ""}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="aire-panel">
          <h3 className="aire-panel-cabecera">
            Inmuebles en el edificio{carga.tipo === "ok" ? ` (${inmuebles.length})` : ""}
          </h3>
          {carga.tipo === "cargando" ? (
            <p className="flex items-center gap-2 p-4 text-[14px] text-[var(--text-2)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Consultando el Catastro…
            </p>
          ) : carga.tipo === "error" ? (
            <p className="p-4 text-[14px] text-[var(--text-2)]">No se han podido cargar los inmuebles ({carga.mensaje}).</p>
          ) : (
            <>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {mostrados.map((i) => (
                  <div key={i.ref} className="aire-tarjeta px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 text-[14px] font-medium">{etiquetaInmueble(i)}</div>
                      <Link
                        href={`/notas-simples/nueva?ref=${i.ref}&direccion=${encodeURIComponent(`${direccionPrincipal(e)}, ${etiquetaInmueble(i)}`)}`}
                        className="shrink-0 text-[12px] text-[var(--text-2)] underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Nota simple
                      </Link>
                    </div>
                    <div className="text-[12px] text-[var(--text-2)]">
                      {[i.uso, i.superficie ? `${i.superficie.toLocaleString("es-ES")} m²` : null].filter(Boolean).join(" · ") || i.ref}
                    </div>
                  </div>
                ))}
              </div>
              {inmuebles.length > 8 ? (
                <button type="button" onClick={() => setVerTodos((v) => !v)} className="mb-3 w-full text-center text-sm text-[var(--text-2)] hover:text-foreground">
                  {verTodos ? "Ver menos" : `Ver los ${inmuebles.length}`}
                </button>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
