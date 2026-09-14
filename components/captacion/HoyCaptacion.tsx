"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FincaCaptacionApi } from "@/lib/catastro-host/captacion-filas";
import { tituloDireccionFinca } from "@/lib/catastro/search-ui";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import { citasDelDia, relacionUno, rutaNuevaVisitaDesdeCita } from "@/lib/citas/citas";
import { ESTADO_CAPTACION_LABEL } from "@/lib/captacion/estados";

type TareaHoy = { id: string; titulo: string; vence: string | null; finca_reference: string | null; estado: string };
type CitaHoy = {
  id: string;
  titulo: string;
  empieza: string;
  tipo: string;
  propiedad_id: string | null;
  estado: string;
  profiles?: { color?: string | null } | null;
};
type ParteHoy = { id: string; visitante_nombre: string | null; estado: string; fecha_visita: string | null };

export function HoyCaptacion() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const [fincas, setFincas] = useState<FincaCaptacionApi[]>([]);
  const [tareas, setTareas] = useState<TareaHoy[]>([]);
  const [citas, setCitas] = useState<CitaHoy[]>([]);
  const [partes, setPartes] = useState<ParteHoy[]>([]);
  const [demandasNuevas, setDemandasNuevas] = useState(0);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    void fetch("/api/catastro/mine")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as { ok?: boolean; items?: FincaCaptacionApi[] };
        if (json.ok) setFincas(json.items ?? []);
      })
      .catch(() => undefined);

    let tareasQ = supabase
      .from("tareas")
      .select("id, titulo, vence, finca_reference, estado")
      .eq("estado", "pendiente")
      .order("vence");
    if (!admin) tareasQ = tareasQ.eq("comercial_id", user.id);

    let citasQ = supabase
      .from("citas")
      .select("id, titulo, empieza, tipo, propiedad_id, estado, profiles:comercial_id(color)")
      .eq("estado", "prevista")
      .gte("empieza", `${hoy}T00:00:00`)
      .lt("empieza", `${hoy}T23:59:59`);
    if (!admin) citasQ = citasQ.eq("comercial_id", user.id);

    void Promise.all([
      tareasQ,
      citasQ,
      supabase.from("partes_visita").select("id, visitante_nombre, estado, fecha_visita").eq("estado", "pendiente_firma").limit(10),
      supabase.from("demandas").select("id", { count: "exact", head: true }).eq("estado", "activa"),
    ]).then(([t, c, p, d]) => {
      setTareas((t.data ?? []) as TareaHoy[]);
      setCitas(
        ((c.data ?? []) as Array<CitaHoy & { profiles?: CitaHoy["profiles"] | CitaHoy["profiles"][] }>).map((row) => ({
          ...row,
          profiles: relacionUno(row.profiles),
        }))
      );
      setPartes((p.data ?? []) as ParteHoy[]);
      setDemandasNuevas(d.count ?? 0);
    });
  }, [user, admin, hoy]);

  const pendientesFinca = fincas.filter(
    (item) =>
      item.estado === "nueva" ||
      (item.proximaAccionEn != null && item.proximaAccionEn <= hoy && item.estado !== "descartada")
  );
  const citasHoy = citasDelDia(citas, hoy);

  const marcarTarea = async (id: string) => {
    const supabase = createClient();
    await supabase.from("tareas").update({ estado: "hecha" }).eq("id", id);
    setTareas((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/catastro" label="Fincas a tocar" valor={String(pendientesFinca.length)} />
        <Kpi href="/calendario" label="Citas hoy" valor={String(citasHoy.length)} />
        <Kpi href="/partes-visita" label="Partes sin firmar" valor={String(partes.length)} />
        <Kpi href="/demandas" label="Demandas activas" valor={String(demandasNuevas)} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Citas de hoy</h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/calendario">Calendario</Link>
          </Button>
        </div>
        <ul className="space-y-2">
          {citasHoy.map((cita) => (
            <li key={cita.id} className="flex items-center justify-between rounded-xl border border-[#E6E3DD] bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: cita.profiles?.color || "#3A6A82" }}
                  aria-hidden
                />
                <div>
                  <p className="font-medium">{cita.titulo}</p>
                  <p className="text-xs text-[#5D6B67]">
                    {new Date(cita.empieza).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {cita.tipo}
                  </p>
                </div>
              </div>
              {cita.tipo === "visita" ? (
                <Button asChild size="sm">
                  <Link href={rutaNuevaVisitaDesdeCita({ id: cita.id, propiedadId: cita.propiedad_id })}>
                    Hacer parte
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
          {citasHoy.length === 0 ? <li className="text-sm text-[#5D6B67]">No hay citas para hoy.</li> : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Tareas</h2>
        <ul className="space-y-2">
          {tareas.map((tarea) => (
            <li key={tarea.id} className="flex items-center justify-between rounded-xl border border-[#E6E3DD] bg-white px-4 py-3">
              <div>
                <p className="font-medium">{tarea.titulo}</p>
                <p className="text-xs text-[#5D6B67]">{tarea.vence ?? "Sin fecha"}</p>
              </div>
              <div className="flex gap-2">
                {tarea.finca_reference ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={rutaFincaPersistida(tarea.finca_reference)}>Finca</Link>
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" onClick={() => void marcarTarea(tarea.id)}>
                  Hecha
                </Button>
              </div>
            </li>
          ))}
          {tareas.length === 0 ? <li className="text-sm text-[#5D6B67]">No hay tareas pendientes.</li> : null}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Fincas que toca trabajar</h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/catastro">Bandeja</Link>
          </Button>
        </div>
        <ul className="space-y-2">
          {pendientesFinca.slice(0, 8).map((item) => (
            <li key={item.fincaReference}>
              <Link
                href={rutaFincaPersistida(item.fincaReference)}
                className="flex items-center justify-between rounded-xl border border-[#E6E3DD] bg-white px-4 py-3 hover:bg-[#FBFBF9]"
              >
                <span className="font-medium">{tituloDireccionFinca(item.finca)}</span>
                <span className="text-xs text-[#5D6B67]">{ESTADO_CAPTACION_LABEL[item.estado]}</span>
              </Link>
            </li>
          ))}
          {pendientesFinca.length === 0 ? (
            <li className="text-sm text-[#5D6B67]">No hay fincas pendientes para hoy.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ href, label, valor }: { href: string; label: string; valor: string }) {
  return (
    <Link href={href}>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{valor}</p>
          <p className="mt-1 text-sm text-neutral-500">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
