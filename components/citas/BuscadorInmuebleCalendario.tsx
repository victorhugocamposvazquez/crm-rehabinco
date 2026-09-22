"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { InmueblePreviewCita } from "@/components/citas/InmueblePreviewCita";
import { altaControl } from "@/components/ui/alta-form";
import { createClient } from "@/lib/supabase/client";
import {
  BUSQUEDA_INMUEBLE_LIMIT,
  MIN_CHARS_BUSQUEDA_INMUEBLE,
  direccionDeInmueble,
  etiquetaInmueble,
  mapInmuebleCalendario,
  orFiltroInmueble,
  SELECT_INMUEBLE_CALENDARIO,
  type InmuebleCalendario,
} from "@/lib/citas/citas";

export function BuscadorInmuebleCalendario({
  inmueble,
  onElegir,
  onQuitar,
}: {
  inmueble: InmuebleCalendario | null;
  onElegir: (inmueble: InmuebleCalendario) => void;
  onQuitar: () => void;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<InmuebleCalendario[]>([]);

  useEffect(() => {
    if (inmueble) {
      setQ("");
      setResultados([]);
      setAbierto(false);
    }
  }, [inmueble]);

  useEffect(() => {
    const filtro = orFiltroInmueble(q);
    if (!filtro) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    const t = window.setTimeout(() => {
      const supabase = createClient();
      void supabase
        .from("propiedades")
        .select(SELECT_INMUEBLE_CALENDARIO)
        .or(filtro)
        .order("updated_at", { ascending: false })
        .limit(BUSQUEDA_INMUEBLE_LIMIT)
        .then(({ data, error }) => {
          setBuscando(false);
          if (error) {
            setResultados([]);
            return;
          }
          setResultados((data ?? []).map((row) => mapInmuebleCalendario(row)));
        });
    }, 220);

    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!abierto) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [abierto]);

  const qTrim = q.trim();
  const puedeBuscar = qTrim.length >= MIN_CHARS_BUSQUEDA_INMUEBLE;
  const mostrarLista = abierto && puedeBuscar && !inmueble;

  if (inmueble) {
    return (
      <div>
        <div className="flex justify-end">
          <button type="button" onClick={onQuitar} className="text-[13px] font-semibold text-accent">
            Cambiar
          </button>
        </div>
        <InmueblePreviewCita inmueble={inmueble} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={listId}
        aria-autocomplete="list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(evento) => {
          if (evento.key !== "Enter" || !puedeBuscar || buscando) return;
          evento.preventDefault();
          if (resultados.length === 1) {
            onElegir(resultados[0]!);
            setQ("");
            setAbierto(false);
          }
        }}
        placeholder="Referencia, calle o localidad"
        autoComplete="off"
        className={altaControl}
      />

      {!puedeBuscar ? (
        <p className="mt-2.5 text-[12.5px] leading-5 text-[var(--text-3)]">
          Escribe al menos {MIN_CHARS_BUSQUEDA_INMUEBLE} caracteres para buscar en el stock. No se listan todos los inmuebles.
        </p>
      ) : buscando ? (
        <p className="mt-2.5 inline-flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Buscando…
        </p>
      ) : null}

      {mostrarLista ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-[12px] border border-[var(--border)] bg-white py-1 shadow-[0_8px_24px_rgba(28,25,23,0.1)]"
        >
          {resultados.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-[var(--text-2)]">No hay inmuebles con «{qTrim}».</li>
          ) : (
            resultados.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--surface-soft)]"
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => {
                    onElegir(p);
                    setQ("");
                    setAbierto(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{etiquetaInmueble(p)}</span>
                    {direccionDeInmueble(p) ? (
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">{direccionDeInmueble(p)}</span>
                    ) : null}
                  </span>
                  {p.referencia ? (
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                      {p.referencia}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
          {resultados.length >= BUSQUEDA_INMUEBLE_LIMIT ? (
            <li className="border-t border-[var(--border-soft)] px-4 py-2 text-[11.5px] text-[var(--text-3)]">
              Mostrando los {BUSQUEDA_INMUEBLE_LIMIT} más recientes. Afina la búsqueda si no aparece.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
