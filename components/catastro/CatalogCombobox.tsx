"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CatalogComboboxProps<T> = {
  id: string;
  items: T[];
  value: T | null;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string | null;
  placeholder: string;
  emptyText?: string;
  hint?: string;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  filterItems: (items: T[], query: string) => T[];
  onChange: (item: T | null) => void;
};

export function CatalogCombobox<T>({
  id,
  items,
  value,
  disabled,
  loading,
  loadingText,
  placeholder,
  emptyText = "No hay coincidencias en el listado oficial.",
  hint,
  getKey,
  getLabel,
  filterItems,
  onChange,
}: CatalogComboboxProps<T>) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (value) setQuery(getLabel(value));
  }, [value, getLabel]);

  useEffect(() => {
    if (!abierto) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [abierto]);

  const visibles = useMemo(() => filterItems(items, query), [filterItems, items, query]);
  const mostrarLista = abierto && !disabled && !loading;

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || loading}
        placeholder={loading ? loadingText ?? "Cargando..." : placeholder}
        value={loading ? "" : query}
        autoComplete="off"
        onFocus={() => {
          if (!disabled && !loading) setAbierto(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setAbierto(true);
          if (value && event.target.value !== getLabel(value)) onChange(null);
        }}
      />
      {loading ? (
        <p className="mt-1 text-xs text-neutral-500">{loadingText}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}

      {mostrarLista ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-[0_8px_20px_rgba(28,25,23,0.08)]"
        >
          {visibles.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-500">{emptyText}</li>
          ) : (
            visibles.map((item) => {
              const seleccionado = value ? getKey(value) === getKey(item) : false;
              return (
                <li key={getKey(item)} role="option" aria-selected={seleccionado}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-accent/5",
                      seleccionado && "bg-accent/10 font-medium text-accent"
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(item);
                      setQuery(getLabel(item));
                      setAbierto(false);
                    }}
                  >
                    {getLabel(item)}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
