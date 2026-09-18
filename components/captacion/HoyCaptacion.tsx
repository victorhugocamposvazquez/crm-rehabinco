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
import { citasDelDia, horaCita, relacionUno, rutaNuevaVisitaDesdeCita } from "@/lib/citas/citas";
import { ESTADO_CAPTACION_LABEL } from "@/lib/captacion/estados";
import { agruparTareas, bandejaDeTarea, recuentoTareas } from "@/lib/tareas/tareas";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";

type TareaHoy = { id: string; titulo: string; vence: string | null; finca_reference: string | null; estado: string; comercial_id?: string };
type CitaHoy = {
  id: string;
  comercial_id?: string;
  titulo: string;
  empieza: string;
  tipo: string;
  propiedad_id: string | null;
  estado: string;
  profiles?: { color?: string | null; nombre_completo?: string | null } | null;
};
type ParteHoy = { id: string; visitante_nombre: string | null; estado: string; fecha_visita: string | null; inmueble_direccion?: string | null };
type MesFacturado = { mes: string; total: number };

export function HoyCaptacion({ facturacionMeses }: { facturacionMeses?: MesFacturado[] }) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const { comercialId, setComercialId } = useFiltroComercial();
  const [fincas, setFincas] = useState<FincaCaptacionApi[]>([]);
  const [tareas, setTareas] = useState<TareaHoy[]>([]);
  const [citas, setCitas] = useState<CitaHoy[]>([]);
  const [partes, setPartes] = useState<ParteHoy[]>([]);
  const [demandasNuevas, setDemandasNuevas] = useState(0);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    void fetch("/api/catastro/mine")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as { ok?: boolean; items?: FincaCaptacionApi[] };
        if (json.ok) setFincas(json.items ?? []);
      })
      .catch(() => undefined);

    const tareasQ = supabase
      .from("tareas")
      .select("id, titulo, vence, finca_reference, estado, comercial_id")
      .neq("estado", "hecha")
      .order("vence");

    let citasQ = supabase
      .from("citas")
      .select("id, comercial_id, titulo, empieza, tipo, propiedad_id, estado, profiles:comercial_id(color, nombre_completo)")
      .eq("estado", "prevista")
      .gte("empieza", `${hoy}T00:00:00`)
      .lt("empieza", `${hoy}T23:59:59`);
    let partesQ = supabase
      .from("partes_visita")
      .select("id, visitante_nombre, estado, fecha_visita, inmueble_direccion")
      .eq("estado", "pendiente_firma")
      .limit(10);
    if (!admin) partesQ = partesQ.eq("comercial_id", user.id);

    void Promise.all([
      tareasQ,
      citasQ,
      partesQ,
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
    if (admin) {
      void supabase
        .from("profiles")
        .select("id, nombre_completo, email, color")
        .in("role", ["comercial", "admin", "superadmin"])
        .eq("activo", true)
        .then(({ data }) =>
          setComerciales(
            (data ?? []).map((item) => ({
              id: item.id,
              nombre: item.nombre_completo || item.email || "Comercial",
              color: item.color,
            }))
          )
        );
    }
  }, [user, admin, hoy]);

  const pendientesFinca = fincas.filter(
    (item) =>
      item.estado === "nueva" ||
      (item.proximaAccionEn != null && item.proximaAccionEn <= hoy && item.estado !== "descartada")
  );
  const citasHoy = citasDelDia(
    comercialId ? citas.filter((item) => item.comercial_id === comercialId) : citas,
    hoy
  );
  const tareasFiltradas = comercialId ? tareas.filter((item) => item.comercial_id === comercialId) : tareas;
  const gruposTareas = agruparTareas(tareasFiltradas, hoy);
  const recuento = recuentoTareas(tareasFiltradas, hoy);
  const tareasUrgentes = [...gruposTareas.VENCIDAS, ...gruposTareas.HOY];
  const hayVencidas = recuento.VENCIDAS > 0;
  const maxFact = Math.max(1, ...(facturacionMeses ?? []).map((m) => m.total));

  const marcarTarea = async (id: string) => {
    const supabase = createClient();
    await supabase.from("tareas").update({ estado: "hecha" }).eq("id", id);
    setTareas((prev) => prev.filter((item) => item.id !== id));
  };

  const kpis = [
    { href: "/calendario", label: "Citas hoy", valor: String(citasHoy.length), fg: "#131C1A" },
    {
      href: "/tareas",
      label: "Tareas vencidas y de hoy",
      valor: String(recuento.VENCIDAS + recuento.HOY),
      fg: hayVencidas ? "#A33B2A" : "#131C1A",
    },
    { href: "/partes-visita", label: "Partes sin firmar", valor: String(partes.length), fg: partes.length ? "#7A5A10" : "#131C1A" },
    { href: "/demandas", label: "Demandas activas", valor: String(demandasNuevas), fg: "#131C1A" },
    { href: "/catastro", label: "Fincas a tocar", valor: String(pendientesFinca.length), fg: "#131C1A" },
  ];

  return (
    <div className="space-y-5">
      {admin ? <FiltroComercial comerciales={comerciales} valor={comercialId} onChange={setComercialId} /> : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="rounded-[14px] border border-border bg-white px-4 py-3.5 hover:bg-[var(--surface-soft)]">
            <p className="font-mono text-[22px] font-semibold tabular-nums" style={{ color: kpi.fg }}>
              {kpi.valor}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--text-2)]">{kpi.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <h2 className="text-[15px] font-semibold">Citas de hoy</h2>
              <Link href="/calendario" className="text-[12.5px] font-medium text-accent">
                Calendario
              </Link>
            </div>
            <ul>
              {citasHoy.map((cita) => (
                <li key={cita.id} className="flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 last:border-0">
                  <span className="w-12 shrink-0 font-mono text-[12px] tabular-nums text-[var(--text-2)]">{horaCita(cita.empieza)}</span>
                  <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: cita.profiles?.color || "#3A6A82" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{cita.titulo}</p>
                    <p className="text-[12px] capitalize text-[var(--text-2)]">{cita.tipo}</p>
                  </div>
                  {cita.tipo === "visita" ? (
                    <Button asChild size="sm">
                      <Link href={rutaNuevaVisitaDesdeCita({ id: cita.id, propiedadId: cita.propiedad_id })}>Hacer parte</Link>
                    </Button>
                  ) : null}
                </li>
              ))}
              {citasHoy.length === 0 ? (
                <li className="m-3 rounded-[10px] border border-dashed border-[var(--input)] px-3 py-5 text-center text-[12.5px] text-[var(--text-2)]">
                  No hay citas para hoy.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <h2 className="text-[15px] font-semibold">Tareas vencidas / hoy</h2>
              <Link href="/tareas" className="text-[12.5px] font-medium text-accent">
                Tablero
              </Link>
            </div>
            <ul>
              {tareasUrgentes.map((tarea) => {
                const vencida = bandejaDeTarea(tarea.vence, hoy, tarea.estado) === "VENCIDAS";
                return (
                  <li key={tarea.id} className="flex items-start gap-2.5 border-b border-[var(--border-row)] px-4 py-2.5 last:border-0">
                    <button
                      type="button"
                      aria-label="Hecha"
                      onClick={() => void marcarTarea(tarea.id)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px]"
                    >
                      <span className="h-[17px] w-[17px] rounded-[5px] border-[1.5px] border-[#CFCBC2] bg-white" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium leading-snug">{tarea.titulo}</p>
                      <span
                        className="mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[11.5px] font-medium"
                        style={{
                          color: vencida ? "#A33B2A" : "#7A5A10",
                          background: vencida ? "#FBEAE5" : "#FBF0D8",
                        }}
                      >
                        {vencida ? "Vencida" : "Hoy"}
                      </span>
                    </div>
                  </li>
                );
              })}
              {tareasUrgentes.length === 0 ? (
                <li className="m-3 rounded-[10px] border border-dashed border-[var(--input)] px-3 py-5 text-center text-[12.5px] text-[var(--text-2)]">
                  Nada vencido ni para hoy.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <h2 className="text-[15px] font-semibold">Partes sin firmar</h2>
              <Link href="/partes-visita" className="text-[12.5px] font-medium text-accent">
                Visitas
              </Link>
            </div>
            <ul>
              {partes.map((parte) => (
                <li key={parte.id}>
                  <Link
                    href={`/partes-visita/${parte.id}`}
                    className="flex items-center justify-between gap-3 border-b border-[var(--border-row)] px-4 py-2.5 last:border-0 hover:bg-[var(--surface-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">
                        {parte.visitante_nombre || "Visitante"}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--text-2)]">
                        {parte.inmueble_direccion || "Parte pendiente de firma"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--text-2)]">
                      {parte.fecha_visita
                        ? new Date(`${parte.fecha_visita}T12:00:00`).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                          })
                        : "Sin fecha"}
                    </span>
                  </Link>
                </li>
              ))}
              {partes.length === 0 ? (
                <li className="m-3 rounded-[10px] border border-dashed border-[var(--input)] px-3 py-5 text-center text-[12.5px] text-[var(--text-2)]">
                  No hay partes pendientes de firma.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <h2 className="text-[15px] font-semibold">Fincas que toca trabajar</h2>
              <Link href="/seguimiento" className="text-[12.5px] font-medium text-accent">
                Tablero
              </Link>
            </div>
            <ul>
              {pendientesFinca.slice(0, 8).map((item) => (
                <li key={item.fincaReference}>
                  <Link
                    href={rutaFincaPersistida(item.fincaReference)}
                    className="flex items-center justify-between gap-3 border-b border-[var(--border-row)] px-4 py-2.5 last:border-0 hover:bg-[var(--surface-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">{tituloDireccionFinca(item.finca)}</span>
                      <span className="font-mono text-[11.5px] text-[var(--text-3)]">{item.fincaReference}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--text-2)]">{ESTADO_CAPTACION_LABEL[item.estado]}</span>
                  </Link>
                </li>
              ))}
              {pendientesFinca.length === 0 ? (
                <li className="m-3 rounded-[10px] border border-dashed border-[var(--input)] px-3 py-5 text-center text-[12.5px] text-[var(--text-2)]">
                  No hay fincas pendientes para hoy.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        {admin && facturacionMeses && facturacionMeses.length > 0 ? (
          <Card>
            <CardContent>
              <h2 className="mb-4 text-[15px] font-semibold">Facturación 6 meses</h2>
              <div className="flex h-[110px] items-end gap-2">
                {facturacionMeses.map(({ mes, total }, i) => (
                  <div key={mes} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t-[6px]"
                      style={{
                        height: `${Math.max(8, (total / maxFact) * 70)}px`,
                        background: i === facturacionMeses.length - 1 ? "#0B7461" : "#CDE9E1",
                      }}
                      title={total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    />
                    <span className="text-[10.5px] uppercase text-[var(--text-3)]">{mes}</span>
                    <span className="font-mono text-[11px] tabular-nums">
                      {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
