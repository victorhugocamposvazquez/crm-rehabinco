"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listarPapeleraDocumentos, resolverPapelera } from "@/lib/actions/papelera";
import {
  ACCION_PAPELERA_LABEL,
  TIPO_PAPELERA_LABEL,
  type PapeleraItem,
  type TipoDocumentoPapelera,
} from "@/lib/papelera/papelera";

export function PapeleraDocumentosPanel({ tipo }: { tipo?: TipoDocumentoPapelera }) {
  const [items, setItems] = useState<PapeleraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    void listarPapeleraDocumentos(tipo).then((data) => {
      if ("error" in data) {
        toast.error(data.error);
        setItems([]);
      } else {
        setItems(data);
      }
      setLoading(false);
    });
  }, [tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resolver = async (id: string, accion: "aprobar" | "rechazar" | "restaurar") => {
    setBusyId(id);
    const result = await resolverPapelera(id, accion);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Hecho.");
    cargar();
  };

  const grupos = useMemo(() => {
    if (tipo) return [{ tipo, items }];
    const partes = items.filter((item) => item.tipo === "parte_visita");
    const arras = items.filter((item) => item.tipo === "contrato_arras");
    return [
      { tipo: "parte_visita" as const, items: partes },
      { tipo: "contrato_arras" as const, items: arras },
    ].filter((grupo) => grupo.items.length > 0);
  }, [items, tipo]);

  if (loading) {
    return <p className="px-4 py-8 text-center text-[13px] text-[var(--text-2)]">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13.5px] text-[var(--text-2)]">
        No hay nada pendiente en la papelera.
      </p>
    );
  }

  return (
    <>
      {grupos.map((grupo, index) => (
        <div key={grupo.tipo} className={index > 0 ? "border-t border-[var(--border-soft)]" : undefined}>
          {!tipo ? (
            <div className="border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                {TIPO_PAPELERA_LABEL[grupo.tipo]}
              </p>
            </div>
          ) : null}
          {grupo.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 border-b border-[var(--border-row)] px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{item.etiqueta}</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                  {ACCION_PAPELERA_LABEL[item.accion as keyof typeof ACCION_PAPELERA_LABEL]}
                  {tipo ? null : <> · {TIPO_PAPELERA_LABEL[item.tipo as keyof typeof TIPO_PAPELERA_LABEL]}</>} ·{" "}
                  {item.solicitante?.nombre_completo || item.solicitante?.email || "Admin"} ·{" "}
                  {new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.accion === "eliminar" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === item.id}
                    onClick={() => void resolver(item.id, "restaurar")}
                  >
                    Restaurar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === item.id}
                  onClick={() => void resolver(item.id, "rechazar")}
                >
                  Rechazar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === item.id}
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => void resolver(item.id, "aprobar")}
                >
                  Eliminar definitivamente
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
