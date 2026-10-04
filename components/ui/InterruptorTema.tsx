"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

const CLAVE = "crm-tema";

export function fijarTema(tema: "light" | "dark") {
  document.documentElement.classList.toggle("dark", tema === "dark");
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* ignore */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "dark" ? "#0c0c0c" : "#f5f5f5");
}

export function InterruptorTema({ compacto = false }: { compacto?: boolean }) {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    setOscuro(document.documentElement.classList.contains("dark"));
  }, []);

  const alternar = () => {
    const next = oscuro ? "light" : "dark";
    fijarTema(next);
    setOscuro(next === "dark");
  };

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Usar tema claro" : "Usar tema oscuro"}
      title={oscuro ? "Tema claro" : "Tema oscuro"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[9px] text-[var(--text-2)] hover:bg-[var(--surface-soft)] hover:text-foreground",
        compacto ? "h-9 w-9" : "h-9 px-2.5 text-[13px] font-medium"
      )}
    >
      {oscuro ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
      {compacto ? null : <span>{oscuro ? "Claro" : "Oscuro"}</span>}
    </button>
  );
}

export function ToasterConTema() {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    const sync = () => setOscuro(document.documentElement.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return <Toaster position="top-center" theme={oscuro ? "dark" : "light"} richColors closeButton />;
}
