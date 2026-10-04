"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Opcion = { value: string; label: string; disabled?: boolean };

function textoDe(nodo: ReactNode): string {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join("");
  if (isValidElement<{ children?: ReactNode }>(nodo)) return textoDe(nodo.props.children);
  return "";
}

function opcionesDe(nodo: ReactNode): Opcion[] {
  const salida: Opcion[] = [];
  Children.forEach(nodo, (hijo) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(hijo)) return;
    if (hijo.type === "option" || (typeof hijo.type === "string" && hijo.type === "option")) {
      const label = textoDe(hijo.props.children).trim();
      const value = hijo.props.value != null && hijo.props.value !== "" ? String(hijo.props.value) : hijo.props.value === "" ? "" : label;
      salida.push({ value, label: label || value, disabled: hijo.props.disabled });
      return;
    }
    if (hijo.props.children) salida.push(...opcionesDe(hijo.props.children));
  });
  return salida;
}

export function Selector({
  value,
  onChange,
  onBlur,
  children,
  className,
  disabled,
  id,
  name,
  required,
  ref,
  "aria-label": ariaLabel,
}: {
  value?: string | number;
  onChange?: (evento: ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (evento: { target: { value: string; name?: string }; type?: string }) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  ref?: (instance: HTMLSelectElement | null) => void;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  "aria-label"?: string;
}) {
  const opciones = opcionesDe(children);
  const texto = value == null || value === "" ? "" : String(value);
  const [interno, setInterno] = useState(texto);
  useEffect(() => {
    if (value !== undefined) setInterno(value == null || value === "" ? "" : String(value));
  }, [value]);
  const valor = value !== undefined ? texto : interno;
  const actual = opciones.find((opcion) => opcion.value === valor);
  const etiqueta = actual?.label || opciones[0]?.label || "Elegir";
  const [abierto, setAbierto] = useState(false);
  const [marco, setMarco] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const cerrar = () => setAbierto(false);

  const elegir = (siguiente: string) => {
    setInterno(siguiente);
    onChange?.({ target: { value: siguiente, name } } as ChangeEvent<HTMLSelectElement>);
    cerrar();
    botonRef.current?.focus();
  };

  const colocar = () => {
    const boton = botonRef.current;
    if (!boton) return;
    const rect = boton.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom;
    const arriba = espacioAbajo < 220 && rect.top > espacioAbajo;
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setMarco({
      top: arriba ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      arriba,
    });
  };

  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alMover = () => colocar();
    const alPulsar = (evento: MouseEvent) => {
      const destino = evento.target as Node;
      if (botonRef.current?.contains(destino) || listaRef.current?.contains(destino)) return;
      cerrar();
    };
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };
    window.addEventListener("resize", alMover);
    window.addEventListener("scroll", alMover, true);
    document.addEventListener("mousedown", alPulsar);
    document.addEventListener("keydown", alTeclado);
    return () => {
      window.removeEventListener("resize", alMover);
      window.removeEventListener("scroll", alMover, true);
      document.removeEventListener("mousedown", alPulsar);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  const menu =
    abierto && marco && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={listaRef}
            id={listaId}
            role="listbox"
            style={{
              position: "fixed",
              top: marco.arriba ? undefined : marco.top,
              bottom: marco.arriba ? window.innerHeight - marco.top : undefined,
              left: marco.left,
              width: marco.width,
              zIndex: 12000,
            }}
            className="max-h-64 overflow-y-auto rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          >
            {opciones.map((opcion, indice) => {
              const activa = opcion.value === (value ?? "");
              return (
                <button
                  key={`${indice}-${opcion.value}`}
                  type="button"
                  role="option"
                  aria-selected={activa}
                  disabled={opcion.disabled}
                  onClick={() => elegir(opcion.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-foreground",
                    activa ? "bg-accent-soft" : "hover:bg-[var(--surface-soft)]",
                    opcion.disabled && "opacity-40"
                  )}
                >
                  <span className="min-w-0 truncate">{opcion.label}</span>
                  {activa ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <select
        ref={ref}
        name={name}
        required={required}
        disabled={disabled}
        value={valor}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(evento) => onChange?.(evento)}
      >
        {children}
      </select>
      <button
        ref={botonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        onBlur={() => onBlur?.({ target: { value: valor, name }, type: "blur" })}
        onClick={() => {
          if (disabled) return;
          setAbierto((v) => !v);
        }}
        className={cn(
          "relative inline-flex h-9 min-w-0 max-w-full items-center justify-between gap-2 rounded-[9px] border border-[var(--input)] bg-[var(--field)] pl-3 text-left text-[13.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50",
          className,
          "pr-10"
        )}
      >
        <span className="min-w-0 flex-1 truncate">{etiqueta}</span>
        <ChevronDown className={cn("pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-2)] transition-transform", abierto && "rotate-180")} strokeWidth={1.8} />
      </button>
      {menu}
    </>
  );
}
