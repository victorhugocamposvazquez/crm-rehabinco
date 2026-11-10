"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESTADO_CAPTACION_LABEL, type EstadoCaptacion } from "@/lib/captacion/estados";
import type { EncargoApi } from "@/lib/captacion/encargos-db";

type Respuesta = {
  ok?: boolean;
  error?: string;
  encargos?: EncargoApi[];
  puedeEncargar?: boolean;
  asignables?: Array<{ id: string; nombre: string }>;
  creados?: number;
  yaEstaban?: boolean;
  leidos?: number;
};

const PRIORIDAD: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

export function EncargosPagina({ embebida = false }: { embebida?: boolean }) {
  const [encargos, setEncargos] = useState<EncargoApi[] | null>(null);
  const [puedeEncargar, setPuedeEncargar] = useState(false);
  const [asignables, setAsignables] = useState<Array<{ id: string; nombre: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "confirmar" | EstadoCaptacion>("todos");
  const [asignadoA, setAsignadoA] = useState("");
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    void fetch("/api/captacion/encargos")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as Respuesta;
        if (!respuesta.ok || !json.ok) {
          setError(json.error ?? "No se han podido cargar los encargos.");
          setEncargos([]);
          return;
        }
        setEncargos(json.encargos ?? []);
        setPuedeEncargar(Boolean(json.puedeEncargar));
        setAsignables(json.asignables ?? []);
        setAsignadoA((actual) => actual || json.asignables?.[0]?.id || "");
      })
      .catch(() => {
        setError("No se han podido cargar los encargos.");
        setEncargos([]);
      });
  };

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const lista = encargos ?? [];
    if (filtro === "todos") return lista;
    if (filtro === "confirmar") return lista.filter((encargo) => encargo.requiereConfirmacion);
    return lista.filter((encargo) => encargo.estado === filtro);
  }, [encargos, filtro]);

  const crear = async () => {
    setGuardando(true);
    const respuesta = await fetch("/api/captacion/encargos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignadoA, calle, numero, resultado: nota }),
    });
    const json = (await respuesta.json()) as Respuesta;
    setGuardando(false);
    if (!respuesta.ok || !json.ok) {
      toast.error(json.error ?? "No se ha podido encargar.");
      return;
    }
    setCalle("");
    setNumero("");
    setNota("");
    toast.success("Encargo creado. Si no eres tú, le llega el aviso.");
    cargar();
  };

  const importar = async (archivo: File) => {
    if (!asignadoA) {
      toast.error("Elige a quién se lo encargas.");
      return;
    }
    const datos = new FormData();
    datos.set("archivo", archivo);
    datos.set("asignadoA", asignadoA);
    setGuardando(true);
    const respuesta = await fetch("/api/captacion/encargos/importar", { method: "POST", body: datos });
    const json = (await respuesta.json()) as Respuesta;
    setGuardando(false);
    if (!respuesta.ok || !json.ok) {
      toast.error(json.error ?? "No se ha podido importar.");
      return;
    }
    toast.success(
      json.yaEstaban
        ? "Ese Excel ya estaba importado para esa persona."
        : `Importados ${json.creados ?? 0} encargos. Le llega un aviso.`
    );
    cargar();
  };

  const lista = (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["todos", "Todos"],
            ["confirmar", "Por confirmar"],
            ["contactar", "Por contactar"],
            ["visita", "Visita"],
            ["propietario_localizado", "Interesado"],
            ["descartada", "Descartados"],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={`rounded-full border px-3 py-1 text-[12.5px] ${
              filtro === valor ? "border-foreground bg-foreground text-background" : "border-[var(--border)]"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {encargos === null ? <p className="text-sm text-neutral-500">Cargando encargos…</p> : null}
      {encargos && visibles.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay encargos en este filtro.</p>
      ) : null}
      <ul className="space-y-2">
        {visibles.map((encargo) => (
          <li key={encargo.id}>
            <Link
              href={`/catastro/encargos/${encargo.id}`}
              className="block rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 hover:border-foreground"
            >
              <span className="font-semibold">
                {[encargo.calle, encargo.numero].filter(Boolean).join(" ") || "Portal sin dirección"}
              </span>
              <span className="mt-1 block text-[13px] text-[#5C5C5C]">
                {ESTADO_CAPTACION_LABEL[encargo.estado]}
                {encargo.prioridad ? ` · ${PRIORIDAD[encargo.prioridad]}` : ""}
                {encargo.requiereConfirmacion ? " · Confirmar datos" : ""}
                {encargo.posibleDuplicado ? " · Posible duplicado" : ""}
                {puedeEncargar ? ` · ${encargo.asignadoNombre}` : ""}
              </span>
              {encargo.proximaAccion ? (
                <span className="mt-1 block text-[13px]">{encargo.proximaAccion}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      {embebida ? (
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Mis encargos</h2>
          <Link href="/catastro/encargos" className="text-sm underline">
            Abrir bandeja
          </Link>
        </div>
      ) : (
        <PageHeader
          breadcrumb={[{ label: "Catastro", href: "/catastro" }, { label: "Encargos" }]}
          title="Encargos"
          description="El admin encarga el portal. Quien lo tiene asignado sigue la visita, la llamada y el estado."
        />
      )}
      {!embebida && puedeEncargar ? (
        <div className="mb-8 mt-6 grid gap-4 rounded-2xl border border-[#E5E5E5] bg-white p-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Encargar a mano</p>
            <select
              aria-label="Persona"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={asignadoA}
              onChange={(evento) => setAsignadoA(evento.target.value)}
            >
              {asignables.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre}
                </option>
              ))}
            </select>
            <Input aria-label="Calle" placeholder="Calle" value={calle} onChange={(evento) => setCalle(evento.target.value)} />
            <Input aria-label="Número" placeholder="Número" value={numero} onChange={(evento) => setNumero(evento.target.value)} />
            <Input aria-label="Nota" placeholder="Nota" value={nota} onChange={(evento) => setNota(evento.target.value)} />
            <Button type="button" disabled={guardando || !calle} onClick={() => void crear()}>
              Encargar
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Importar Excel</p>
            <p className="text-[13px] text-[#5C5C5C]">Hoja Captación. Calles solo marca la prioridad. Un aviso, no uno por portal.</p>
            <input
              aria-label="Excel de captación"
              type="file"
              accept=".xlsx"
              disabled={guardando}
              onChange={(evento) => {
                const archivo = evento.target.files?.[0];
                if (archivo) void importar(archivo);
                evento.target.value = "";
              }}
            />
          </div>
        </div>
      ) : null}
      <div className={embebida ? "" : "mt-6"}>{lista}</div>
    </div>
  );
}
