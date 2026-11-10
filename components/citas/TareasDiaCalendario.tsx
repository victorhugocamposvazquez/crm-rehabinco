"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ListTodo } from "lucide-react";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { relacionUno } from "@/lib/citas/citas";
import { textoVinculoTarea } from "@/lib/tareas/tareas";
import { FichaLink } from "@/components/crm/FichaPeek";

type TareaDia = {
  id: string;
  titulo: string;
  hora: string | null;
  estado: string;
  comercial_id: string;
  propiedad_id: string | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

export function TareasDiaCalendario({
  dia,
  comercialId,
}: {
  dia: string;
  comercialId: string;
  /** Las hechas del día se muestran siempre, atenuadas, con Reabrir. */
  mostrarHechas?: boolean;
}) {
  const [tareas, setTareas] = useState<TareaDia[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let q = supabase
      .from("tareas")
      .select(
        "id, titulo, hora, estado, comercial_id, propiedad_id, propiedades:propiedad_id(titulo, direccion, referencia), profiles:comercial_id(nombre_completo, color, email)"
      )
      .eq("vence", dia)
      .is("cita_id", null)
      .order("hora", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (comercialId) q = q.eq("comercial_id", comercialId);
    void q.then(({ data }) => {
      setTareas(
        ((data ?? []) as Array<TareaDia & { propiedades?: TareaDia["propiedades"] | TareaDia["propiedades"][] }>).map(
          (row) => ({
            ...row,
            propiedades: relacionUno(row.propiedades),
            profiles: relacionUno(row.profiles as TareaDia["profiles"] | TareaDia["profiles"][] | null),
          })
        )
      );
    });
  }, [dia, comercialId]);

  const reabrir = async (id: string) => {
    const { error } = await createClient().from("tareas").update({ estado: "pendiente" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, estado: "pendiente" } : t)));
    toast.success("Tarea reabierta.");
  };

  if (tareas.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-[15px] font-semibold">
          <ListTodo className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.75} aria-hidden />
          Tareas del día
        </h2>
        <Link href="/tareas" className="text-[12.5px] font-medium text-accent">
          Ver tablero
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {tareas.map((tarea) => {
          const vinculo = textoVinculoTarea({
            propiedad:
              tarea.propiedades?.referencia ||
              tarea.propiedades?.titulo ||
              tarea.propiedades?.direccion ||
              null,
          });
          return (
            <li
              key={tarea.id}
              className={`flex items-start gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3 ${
                tarea.estado === "hecha" ? "opacity-70" : ""
              }`}
            >
              <Link
                href={`/tareas?tarea=${tarea.id}`}
                className="flex min-w-0 flex-1 items-start gap-3 transition-colors hover:bg-[var(--surface-soft)]"
              >
                <AvatarComercial
                  id={tarea.comercial_id}
                  nombre={tarea.profiles?.nombre_completo}
                  email={tarea.profiles?.email}
                  color={tarea.profiles?.color}
                  size={28}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tarea.titulo}</p>
                  <p className="mt-0.5 text-xs text-[#5C5C5C]">
                    {tarea.hora ? `${tarea.hora.slice(0, 5)} · ` : "Sin hora · "}
                    Tarea
                    {tarea.estado === "esperando" ? " · Esperando" : ""}
                    {tarea.estado === "hecha" ? " · Hecha" : ""}
                  </p>
                  {tarea.propiedad_id ? (
                    <span className="mt-1 inline-block" onClick={(e) => e.preventDefault()}>
                      <FichaLink tipo="propiedad" id={tarea.propiedad_id} className="text-xs">
                        {vinculo !== "Sin vincular" ? vinculo : "Ver inmueble"}
                      </FichaLink>
                    </span>
                  ) : vinculo !== "Sin vincular" ? (
                    <p className="mt-1 text-xs text-[#5C5C5C]">{vinculo}</p>
                  ) : null}
                </div>
              </Link>
              {tarea.estado === "hecha" ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void reabrir(tarea.id)}>
                  Reabrir
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
