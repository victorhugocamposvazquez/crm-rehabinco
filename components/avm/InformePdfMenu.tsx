"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Variant = "propietario" | "interno";

export function InformePdfMenu({ valuationId }: { valuationId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setAbierto(false);
    };
    window.addEventListener("mousedown", cerrar);
    return () => window.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  async function generar(variant: Variant, theme?: "light") {
    const clave = theme === "light" ? "clara" : variant;
    setGenerando(clave);
    setAbierto(false);
    try {
      const res = await fetch(`/api/avm/valuations/${valuationId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme ? { variant, theme } : { variant }),
      });
      const tipo = res.headers.get("content-type") ?? "";
      if (!res.ok || !tipo.includes("application/pdf")) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "No se ha podido generar el PDF");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("content-disposition") ?? "";
      const encoded = /filename\*=UTF-8''([^;]+)/.exec(dispo)?.[1];
      const nombre = encoded ? decodeURIComponent(encoded) : "valoracion.pdf";
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se ha podido generar el PDF");
    } finally {
      setGenerando(null);
    }
  }

  const etiqueta = generando === "propietario" ? "Generando para el propietario…" : generando === "interno" ? "Generando interno…" : generando === "clara" ? "Generando versión clara…" : "Informe PDF";

  return (
    <div className="relative" ref={ref}>
      <Button type="button" size="sm" variant="secondary" disabled={Boolean(generando)} onClick={() => setAbierto((v) => !v)}>
        {etiqueta}
      </Button>
      {abierto ? (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
          <Opcion onClick={() => void generar("propietario")}>Para el propietario</Opcion>
          <Opcion onClick={() => void generar("interno")}>Interno</Opcion>
          <Opcion onClick={() => void generar("propietario", "light")}>Versión clara para imprimir</Opcion>
        </div>
      ) : null}
    </div>
  );
}

function Opcion({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-soft)]"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
