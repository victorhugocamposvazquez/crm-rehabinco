"use client";

import { useEffect, useRef, useState } from "react";
import { NOTAS_FINCA_MAX } from "@/lib/catastro-host/finca-notes";

type Props = {
  fincaReference: string;
};

export function NotasFinca({ fincaReference }: Props) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"cargando" | "idle" | "guardando" | "guardado" | "error">("cargando");
  const [error, setError] = useState<string | null>(null);
  const ultimoGuardado = useRef("");
  const carga = useRef(0);
  const listo = useRef(false);

  useEffect(() => {
    const id = ++carga.current;
    listo.current = false;
    setEstado("cargando");
    setError(null);
    void fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/notes`)
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as { ok?: boolean; note?: { notes?: string }; error?: string };
        if (id !== carga.current) return;
        if (!respuesta.ok || !json.ok) {
          setError(json.error ?? "No se han podido leer las notas.");
          setEstado("error");
          return;
        }
        const notes = json.note?.notes ?? "";
        setTexto(notes);
        ultimoGuardado.current = notes;
        listo.current = true;
        setEstado("idle");
      })
      .catch(() => {
        if (id !== carga.current) return;
        setError("No se han podido leer las notas.");
        setEstado("error");
      });
  }, [fincaReference]);

  useEffect(() => {
    if (!listo.current || texto === ultimoGuardado.current) return;
    const id = carga.current;
    const timer = window.setTimeout(() => {
      void persistir(fincaReference, texto, id, carga, ultimoGuardado, setEstado, setError);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [texto, fincaReference]);

  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[#131C1A]">Notas</h3>
        <p className="text-[11.5px] text-[#6B7A76]">
          {estado === "cargando"
            ? "Cargando…"
            : estado === "guardando"
              ? "Guardando…"
              : estado === "guardado"
                ? "Guardado"
                : estado === "error"
                  ? error
                  : "Del equipo · se guardan solas"}
        </p>
      </div>
      <textarea
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value.slice(0, NOTAS_FINCA_MAX));
          if (estado === "error" || estado === "guardado") setEstado("idle");
          setError(null);
        }}
        onBlur={() => {
          if (estado === "cargando" || texto === ultimoGuardado.current) return;
          void persistir(fincaReference, texto, carga.current, carga, ultimoGuardado, setEstado, setError);
        }}
        disabled={estado === "cargando"}
        rows={5}
        maxLength={NOTAS_FINCA_MAX}
        placeholder="Anotaciones sobre esta finca: contacto, visita, impresión…"
        className="mt-2 min-h-[120px] w-full resize-y rounded-[10px] border border-[#DAD6CE] bg-[#FDFDFC] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#131C1A] placeholder:text-[#8A938F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] disabled:opacity-60"
      />
    </section>
  );
}

async function persistir(
  fincaReference: string,
  notes: string,
  id: number,
  carga: { current: number },
  ultimoGuardado: { current: string },
  setEstado: (estado: "guardando" | "guardado" | "error") => void,
  setError: (mensaje: string | null) => void
) {
  setEstado("guardando");
  try {
    const respuesta = await fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const json = (await respuesta.json()) as { ok?: boolean; note?: { notes?: string }; error?: string };
    if (id !== carga.current) return;
    if (!respuesta.ok || !json.ok) {
      setError(json.error ?? "No se han podido guardar las notas.");
      setEstado("error");
      return;
    }
    ultimoGuardado.current = json.note?.notes ?? notes;
    setEstado("guardado");
  } catch {
    if (id !== carga.current) return;
    setError("No se han podido guardar las notas.");
    setEstado("error");
  }
}
