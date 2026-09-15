"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MIN_LETRAS_LOCALIDAD } from "@/lib/geo/constantes";

type Item = { nombre: string; provincia: string; etiqueta: string };

export function BuscadorLocalidad({
  value,
  onChange,
  multiple = false,
  placeholder = "Escribe 3 letras…",
  inputClassName,
}: {
  value: string | string[];
  onChange: (valor: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  inputClassName?: string;
}) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [abierto, setAbierto] = useState(false);
  const seleccionadas = Array.isArray(value) ? value : value ? [value] : [];

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < MIN_LETRAS_LOCALIDAD) {
      setItems([]);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/geo/municipios?q=${encodeURIComponent(texto)}`, { signal: ac.signal })
        .then((r) => r.json() as Promise<{ items?: Item[] }>)
        .then((data) => setItems(data.items ?? []))
        .catch(() => {
          if (!ac.signal.aborted) setItems([]);
        });
    }, 180);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const elegir = (item: Item) => {
    if (multiple) {
      const siguiente = seleccionadas.includes(item.nombre)
        ? seleccionadas
        : [...seleccionadas, item.nombre];
      onChange(siguiente);
    } else {
      onChange(item.nombre);
    }
    setQ("");
    setItems([]);
    setAbierto(false);
  };

  const quitar = (nombre: string) => {
    if (multiple) onChange(seleccionadas.filter((z) => z !== nombre));
    else onChange("");
  };

  const altaLibre = () => {
    const texto = q.trim();
    if (texto.length < MIN_LETRAS_LOCALIDAD) return;
    if (multiple) {
      if (!seleccionadas.includes(texto)) onChange([...seleccionadas, texto]);
    } else {
      onChange(texto);
    }
    setQ("");
    setItems([]);
    setAbierto(false);
  };

  return (
    <div ref={caja} className="relative">
      {multiple && seleccionadas.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {seleccionadas.map((zona) => (
            <button
              key={zona}
              type="button"
              onClick={() => quitar(zona)}
              className="flex h-9 items-center rounded-full border border-accent bg-accent-soft px-3 text-[13px] font-medium text-accent-dark"
            >
              {zona} ×
            </button>
          ))}
        </div>
      ) : null}
      <input
        id={id}
        value={multiple ? q : q || (!Array.isArray(value) ? value : "")}
        onChange={(e) => {
          const texto = e.target.value;
          setQ(texto);
          setAbierto(true);
          if (!multiple) onChange(texto);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (items[0]) elegir(items[0]);
            else altaLibre();
          }
          if (e.key === "Escape") setAbierto(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "h-11 w-full rounded-[10px] border border-[var(--input)] bg-white px-3.5 text-[15px] outline-none placeholder:text-[var(--text-3)] focus:border-accent focus:ring-[3px] focus:ring-accent/15",
          inputClassName
        )}
      />
      {abierto && q.trim().length > 0 && q.trim().length < MIN_LETRAS_LOCALIDAD ? (
        <p className="mt-1.5 text-[12px] text-[var(--text-3)]">Escribe al menos 3 letras para buscar en toda España.</p>
      ) : null}
      {abierto && items.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[10px] border border-border bg-white py-1 shadow-lg">
          {items.map((item) => (
            <li key={`${item.nombre}-${item.provincia}`}>
              <button
                type="button"
                onClick={() => elegir(item)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[14px] hover:bg-[var(--surface-soft)]"
              >
                <span className="font-medium">{item.nombre}</span>
                <span className="text-[12px] text-[var(--text-3)]">{item.provincia}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
