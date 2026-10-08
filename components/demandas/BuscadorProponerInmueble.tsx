"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BUSQUEDA_INMUEBLE_LIMIT,
  MIN_CHARS_BUSQUEDA_INMUEBLE,
  direccionDeInmueble,
  etiquetaInmueble,
  orFiltroInmueble,
} from "@/lib/citas/citas";

type InmuebleBusqueda = {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  referencia: string | null;
};

export function BuscadorProponerInmueble({ onElegir }: { onElegir: (propiedadId: string) => void }) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<InmuebleBusqueda[]>([]);

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
        .select("id, titulo, direccion, localidad, referencia")
        .or(filtro)
        .order("updated_at", { ascending: false })
        .limit(BUSQUEDA_INMUEBLE_LIMIT)
        .then(({ data, error }) => {
          setBuscando(false);
          if (error) {
            setResultados([]);
            return;
          }
          setResultados((data ?? []) as InmuebleBusqueda[]);
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
  const mostrarLista = abierto && puedeBuscar;

  return (
    <div ref={wrapRef} className="relative mt-3">
      <label className="relative block">
        <span className="sr-only">Proponer un inmueble a mano</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-2)]" strokeWidth={2} />
        <input
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listId}
          aria-autocomplete="list"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Referencia, calle o título"
          autoComplete="off"
          className="h-11 w-full rounded-[9px] border border-[var(--input)] bg-[var(--field)] pl-9 pr-3 text-[16px] text-foreground outline-none placeholder:text-[var(--text-3)] focus:border-accent min-[820px]:h-9 min-[820px]:text-[13.5px]"
        />
      </label>
      {!puedeBuscar && abierto ? (
        <p className="mt-2 text-[12.5px] text-[var(--text-3)]">Escribe al menos {MIN_CHARS_BUSQUEDA_INMUEBLE} caracteres.</p>
      ) : null}
      {puedeBuscar && buscando ? (
        <p className="mt-2 inline-flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Buscando…
        </p>
      ) : null}
      {mostrarLista && !buscando ? (
        <ul id={listId} role="listbox" className="caja-flotante absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-[12px] py-1">
          {resultados.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-[var(--text-2)]">No hay inmuebles con «{qTrim}».</li>
          ) : (
            resultados.map((inmueble) => (
              <li key={inmueble.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--surface-soft)]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onElegir(inmueble.id);
                    setQ("");
                    setAbierto(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{etiquetaInmueble(inmueble)}</span>
                    {direccionDeInmueble(inmueble) ? (
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">{direccionDeInmueble(inmueble)}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
