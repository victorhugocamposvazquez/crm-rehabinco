"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FechaInput } from "@/components/ui/fecha-hora";
import { Label } from "@/components/ui/label";
import { ESTADO_CAPTACION_LABEL, ESTADOS_CAPTACION } from "@/lib/captacion/estados";
import type { ActividadEncargo, EncargoApi } from "@/lib/captacion/encargos-db";

const TIPO: Record<string, string> = {
  visita: "Visita",
  llamada: "Llamada",
  nota: "Nota",
  estado: "Estado",
  asignacion: "Encargo",
  propiedad: "Finca",
};

export function EncargoDetalle({ id }: { id: string }) {
  const [encargo, setEncargo] = useState<EncargoApi | null>(null);
  const [actividad, setActividad] = useState<ActividadEncargo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    void fetch(`/api/captacion/encargos/${id}`)
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as {
          ok?: boolean;
          error?: string;
          encargo?: EncargoApi;
          actividad?: ActividadEncargo[];
        };
        if (!respuesta.ok || !json.ok || !json.encargo) {
          setError(json.error ?? "Encargo no encontrado.");
          return;
        }
        setEncargo(json.encargo);
        setActividad(json.actividad ?? []);
      })
      .catch(() => setError("No se ha podido cargar el encargo."));
  };

  useEffect(() => {
    cargar();
  }, [id]);

  const guardar = async (cambios: Record<string, string>) => {
    setGuardando(true);
    const respuesta = await fetch(`/api/captacion/encargos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const json = (await respuesta.json()) as { ok?: boolean; error?: string; aviso?: string };
    setGuardando(false);
    if (!respuesta.ok || !json.ok) {
      toast.error(json.error ?? "No se ha podido guardar.");
      return;
    }
    if (json.aviso) toast.message(json.aviso);
    cargar();
  };

  const anotar = async (tipo: "visita" | "llamada" | "nota") => {
    if (!nota.trim()) {
      toast.error("Escribe qué ha pasado.");
      return;
    }
    setGuardando(true);
    const respuesta = await fetch(`/api/captacion/encargos/${id}/actividad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, detalle: nota }),
    });
    const json = (await respuesta.json()) as { ok?: boolean; error?: string };
    setGuardando(false);
    if (!respuesta.ok || !json.ok) {
      toast.error(json.error ?? "No se ha podido anotar.");
      return;
    }
    setNota("");
    cargar();
  };

  const vincular = async () => {
    setGuardando(true);
    const respuesta = await fetch(`/api/captacion/encargos/${id}/vincular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fincaReference: referencia }),
    });
    const json = (await respuesta.json()) as { ok?: boolean; error?: string };
    setGuardando(false);
    if (!respuesta.ok || !json.ok) {
      toast.error(json.error ?? "No se ha podido vincular.");
      return;
    }
    setReferencia("");
    toast.success("Finca vinculada.");
    cargar();
  };

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!encargo) return <p className="text-sm text-neutral-500">Cargando…</p>;

  const titulo = [encargo.calle, encargo.numero].filter(Boolean).join(" ") || "Portal";

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Catastro", href: "/catastro" },
          { label: "Encargos", href: "/catastro/encargos" },
          { label: titulo },
        ]}
        title={titulo}
        description={[encargo.municipio, encargo.tipoUso].filter(Boolean).join(" · ")}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-2xl border border-[#E5E5E5] bg-white p-4">
          {encargo.requiereConfirmacion ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Hay datos por confirmar antes de llamar. El teléfono y el nombre se guardan tal como venían en el apunte.
            </p>
          ) : null}
          {encargo.resultado ? <p className="text-sm">{encargo.resultado}</p> : null}
          {encargo.notasRevision ? <p className="text-sm text-[#5C5C5C]">{encargo.notasRevision}</p> : null}
          <p className="text-sm">
            {encargo.contactoNombre ? <span className="mr-3">{encargo.contactoNombre}</span> : null}
            {encargo.telefono ? <span className="mr-3">{encargo.telefono}</span> : null}
            {encargo.email ? <span>{encargo.email}</span> : null}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="estado">Estado</Label>
              <select
                id="estado"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={encargo.estado}
                disabled={guardando}
                onChange={(evento) => void guardar({ estado: evento.target.value })}
              >
                {ESTADOS_CAPTACION.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_CAPTACION_LABEL[estado]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cuando">Próxima acción</Label>
              <FechaInput
                id="cuando"
                className="mt-1"
                value={encargo.proximaAccionEn ?? ""}
                onChange={(proximaAccionEn) => void guardar({ proximaAccionEn })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="proxima">Qué toca hacer</Label>
            <Input
              id="proxima"
              className="mt-1"
              defaultValue={encargo.proximaAccion ?? ""}
              onBlur={(evento) => {
                if (evento.target.value !== (encargo.proximaAccion ?? "")) {
                  void guardar({ proximaAccion: evento.target.value });
                }
              }}
            />
          </div>
          <div>
            <Label htmlFor="anotacion">Visita, llamada o nota</Label>
            <textarea
              id="anotacion"
              className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={nota}
              onChange={(evento) => setNota(evento.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" disabled={guardando} onClick={() => void anotar("visita")}>
                Anotar visita
              </Button>
              <Button type="button" variant="secondary" disabled={guardando} onClick={() => void anotar("llamada")}>
                Anotar llamada
              </Button>
              <Button type="button" variant="secondary" disabled={guardando} onClick={() => void anotar("nota")}>
                Anotar nota
              </Button>
            </div>
          </div>
          {encargo.fincaReference ? (
            <Link className="text-sm underline" href={`/catastro/finca/${encargo.fincaReference}`}>
              Abrir finca {encargo.fincaReference}
            </Link>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1">
                <Label htmlFor="rc">Vincular referencia catastral</Label>
                <Input id="rc" className="mt-1" value={referencia} onChange={(evento) => setReferencia(evento.target.value)} />
              </div>
              <Button type="button" variant="secondary" disabled={guardando || referencia.trim().length < 14} onClick={() => void vincular()}>
                Vincular
              </Button>
            </div>
          )}
        </div>
        <aside className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-sm font-semibold">Seguimiento</p>
          <ul className="mt-3 space-y-3">
            {actividad.length === 0 ? <li className="text-sm text-neutral-500">Todavía no hay anotaciones.</li> : null}
            {actividad.map((item) => (
              <li key={item.id} className="text-sm">
                <span className="font-medium">{TIPO[item.tipo] ?? item.tipo}</span>
                <span className="mt-0.5 block text-[#5C5C5C]">{item.detalle}</span>
                <span className="mt-0.5 block text-[12px] text-neutral-400">
                  {new Date(item.createdAt).toLocaleString("es-ES")}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
