"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
};

export function EditableText({ value, onChange, className, style, placeholder, multiline }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || document.activeElement === nodo) return;
    if (nodo.textContent !== value) nodo.textContent = value;
  }, [value]);

  return (
    <span
      ref={ref}
      role="textbox"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={cn(
        "block min-w-[2ch] rounded-sm outline-none ring-[var(--accent)] focus:ring-2 focus:ring-offset-2",
        multiline && "min-h-[1.5em] whitespace-pre-wrap",
        "empty:before:text-[var(--text-3)] empty:before:content-[attr(data-placeholder)]",
        className
      )}
      style={style}
      onInput={() => onChange(ref.current?.textContent ?? "")}
    />
  );
}
