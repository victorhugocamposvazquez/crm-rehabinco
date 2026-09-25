"use client";

import { type ComponentProps, forwardRef, useLayoutEffect, useRef } from "react";
import {
  horaDesdeDigitosPegado,
  horasCompletas,
  seleccionSegmentoMinutos,
} from "@/lib/ui/time-input";
import { cn } from "@/lib/utils";

export type TimeInputProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { className, value, onChange, onKeyUp, onInput, ...props },
  ref
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const prevRef = useRef(value);
  const avanzarMinutosTrasRender = useRef(false);

  const setRef = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useLayoutEffect(() => {
    if (!avanzarMinutosTrasRender.current || !innerRef.current) return;
    avanzarMinutosTrasRender.current = false;
    seleccionSegmentoMinutos(innerRef.current);
  }, [value]);

  return (
    <input
      {...props}
      ref={setRef}
      type="time"
      value={value}
      className={cn(className)}
      onChange={(e) => {
        prevRef.current = e.target.value;
        onChange(e.target.value);
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        const pegado = horaDesdeDigitosPegado(el.value, prevRef.current);
        if (pegado) {
          prevRef.current = pegado;
          avanzarMinutosTrasRender.current = true;
          onChange(pegado);
        }
        onInput?.(e);
      }}
      onKeyUp={(e) => {
        if (e.key.length === 1 && /\d/.test(e.key)) {
          const el = e.currentTarget;
          if (horasCompletas(el.value) && (el.selectionStart ?? 0) <= 2) {
            avanzarMinutosTrasRender.current = true;
            seleccionSegmentoMinutos(el);
          }
        }
        onKeyUp?.(e);
      }}
    />
  );
});
