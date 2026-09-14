"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ESTADO_CAPTACION_LABEL,
  ESTADOS_CAPTACION,
  parseEstadoCaptacion,
  type EstadoCaptacion,
} from "@/lib/captacion/estados";
import { detalleCambioEstado, ordenarActividad, type ActividadCaptacion } from "@/lib/captacion/actividad";
import { rutaNuevaVisitaDesdeProperty } from "@/lib/partes-visita";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";

export function PipelineFinca({
  fincaReference,
  propertyId,
}: {
  fincaReference: string;
  propertyId?: string | null;
}) {
  const [estado, setEstado] = useState<EstadoCaptacion>("nueva");
  const [proximaAccion, setProximaAccion] = useState("");
  const [proximaAccionEn, setProximaAccionEn] = useState("");
  const [actividad, setActividad] = useState<ActividadCaptacion[]>([]);
  const [nota, setNota] = useState("");
  const [tarea, setTarea] = useState("");
  const [tareaVence, setTareaVence] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    const supabase = createClient();
    void Promise.all([
      supabase
        .from("catastro_explorer_pipeline")
        .select("estado, proxima_accion, proxima_accion_en")
        .eq("finca_reference", fincaReference)
        .maybeSingle(),
      supabase
        .from("catastro_explorer_actividad")
        .select("id, finca_reference, actor_id, tipo, detalle, payload, created_at")
        .eq("finca_reference", fincaReference)
        .order("created_at", { ascending: false })
        .limit(30),
    ]).then(([pipe, act]) => {
      if (pipe.data) {
        setEstado(parseEstadoCaptacion(pipe.data.estado));
        setProximaAccion(pipe.data.proxima_accion ?? "");
        setProximaAccionEn(pipe.data.proxima_accion_en ?? "");
      }
      setActividad(
        ordenarActividad(
          (act.data ?? []).map((row) => ({
            id: row.id,
            fincaReference: row.finca_reference,
            actorId: row.actor_id,
            tipo: row.tipo,
            detalle: row.detalle,
            payload: (row.payload ?? {}) as Record<string, unknown>,
            createdAt: row.created_at,
          }))
        )
      );
    });
  }, [fincaReference]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarEstado = async (siguiente: EstadoCaptacion) => {
    setGuardando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catastro_explorer_pipeline").upsert(
      {
        finca_reference: fincaReference,
        estado: siguiente,
        proxima_accion: proximaAccion || null,
        proxima_accion_en: proximaAccionEn || null,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "finca_reference" }
    );
    if (error) {
      toast.error("No se ha podido guardar el estado.");
      setGuardando(false);
      return;
    }
    if (siguiente !== estado) {
      await supabase.from("catastro_explorer_actividad").insert({
        finca_reference: fincaReference,
        actor_id: user?.id ?? null,
        tipo: "estado",
        detalle: detalleCambioEstado(estado, siguiente),
        payload: { de: estado, a: siguiente },
      });
    }
    setEstado(siguiente);
    setGuardando(false);
    toast.success("Captación actualizada.");
    cargar();
  };

  const guardarNota = async () => {
    const texto = nota.trim();
    if (!texto) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catastro_explorer_actividad").insert({
      finca_reference: fincaReference,
      actor_id: user?.id ?? null,
      tipo: "llamada",
      detalle: texto,
    });
    if (error) {
      toast.error("No se ha podido guardar la nota.");
      return;
    }
    setNota("");
    toast.success("Anotado.");
    cargar();
  };

  const crearTarea = async () => {
    const titulo = tarea.trim();
    if (!titulo) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("tareas").insert({
      comercial_id: user.id,
      titulo,
      vence: tareaVence || null,
      finca_reference: fincaReference,
      propiedad_id: propertyId ?? null,
    });
    if (error) {
      toast.error("No se ha podido crear la tarea.");
      return;
    }
    await supabase.from("catastro_explorer_actividad").insert({
      finca_reference: fincaReference,
      actor_id: user.id,
      tipo: "tarea",
      detalle: titulo,
    });
    setTarea("");
    toast.success("Tarea creada.");
    cargar();
  };

  return (
    <section className="rounded-2xl border border-[#E6E3DD] bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7A76]">Captación</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="estado-captacion">Estado</Label>
          <select
            id="estado-captacion"
            value={estado}
            disabled={guardando}
            onChange={(e) => void guardarEstado(parseEstadoCaptacion(e.target.value))}
            className="flex h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
          >
            {ESTADOS_CAPTACION.map((item) => (
              <option key={item} value={item}>
                {ESTADO_CAPTACION_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="proxima-en">Próxima acción</Label>
          <Input
            id="proxima-en"
            type="date"
            value={proximaAccionEn}
            onChange={(e) => setProximaAccionEn(e.target.value)}
            onBlur={() => void guardarEstado(estado)}
          />
        </div>
      </div>
      <Input
        className="mt-3"
        placeholder="Qué hay que hacer (llamar, pasar, recoger llaves…)"
        value={proximaAccion}
        onChange={(e) => setProximaAccion(e.target.value)}
        onBlur={() => void guardarEstado(estado)}
      />
      {propertyId ? (
        <Button asChild size="sm" className="mt-3">
          <a href={rutaNuevaVisitaDesdeProperty(propertyId)}>Hacer parte de visita</a>
        </Button>
      ) : (
        <p className="mt-3 text-xs text-[#5D6B67]">
          Crea la propiedad cuando quieras documentar la visita.{" "}
          <a className="font-medium text-[#0B7461] hover:underline" href={rutaFincaPersistida(fincaReference)}>
            Ver ficha
          </a>
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Anotar llamada / nota</Label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Hablé con el portero, 3º izda, teléfono…"
          />
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => void guardarNota()}>
            Guardar nota
          </Button>
        </div>
        <div>
          <Label>Tarea de seguimiento</Label>
          <Input className="mt-1" value={tarea} onChange={(e) => setTarea(e.target.value)} placeholder="Llamar el jueves" />
          <Input className="mt-2" type="date" value={tareaVence} onChange={(e) => setTareaVence(e.target.value)} />
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => void crearTarea()}>
            Crear tarea
          </Button>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {actividad.map((item) => (
          <li key={item.id} className="rounded-xl bg-[#F6F5F1] px-3 py-2 text-sm">
            <p className="font-medium text-[#131C1A]">{item.detalle || item.tipo}</p>
            <p className="text-[11px] text-[#5D6B67]">
              {new Date(item.createdAt).toLocaleString("es-ES")} · {item.tipo}
            </p>
          </li>
        ))}
        {actividad.length === 0 ? (
          <li className="text-sm text-[#5D6B67]">Aún no hay actividad en esta finca.</li>
        ) : null}
      </ol>
    </section>
  );
}
