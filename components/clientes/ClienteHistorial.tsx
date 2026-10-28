"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  etiquetaTipoHistorial,
  itemCita,
  itemDemanda,
  itemFactura,
  itemInmueble,
  itemParte,
  itemPresupuesto,
  itemTarea,
  ordenarHistorial,
  type ItemHistorialCliente,
} from "@/lib/clientes/historial";

function fechaCorta(iso: string) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso.slice(0, 10);
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function ClienteHistorial({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<ItemHistorialCliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    const supabase = createClient();
    void (async () => {
      const [citasPri, citasExtra, tareas, inmuebles, demandas, facturas, presupuestos] = await Promise.all([
        supabase
          .from("citas")
          .select("id, tipo, titulo, empieza, estado, motivo_anulacion, lugar")
          .eq("cliente_id", clienteId)
          .order("empieza", { ascending: false })
          .limit(80),
        supabase
          .from("citas")
          .select("id, tipo, titulo, empieza, estado, motivo_anulacion, lugar")
          .contains("clientes_extra_ids", [clienteId])
          .order("empieza", { ascending: false })
          .limit(40),
        supabase
          .from("tareas")
          .select("id, titulo, vence, hora, estado, created_at")
          .eq("cliente_id", clienteId)
          .order("vence", { ascending: false })
          .limit(60),
        supabase
          .from("propiedades")
          .select("id, titulo, direccion, localidad, tipo_operacion, estado, created_at, updated_at")
          .eq("ofertante_id", clienteId)
          .order("updated_at", { ascending: false })
          .limit(40),
        supabase
          .from("demandas")
          .select("id, tipo_operacion, estado, zonas, updated_at, created_at")
          .eq("cliente_id", clienteId)
          .order("updated_at", { ascending: false })
          .limit(40),
        supabase
          .from("facturas")
          .select("id, numero, estado, created_at")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("presupuestos")
          .select("id, numero, estado, created_at")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      type CitaFila = {
        id: string;
        tipo: string;
        titulo: string;
        empieza: string;
        estado: string;
        motivo_anulacion: string | null;
        lugar: string | null;
      };
      const citasMap = new Map<string, CitaFila>();
      for (const row of [...((citasPri.data ?? []) as CitaFila[]), ...((citasExtra.data ?? []) as CitaFila[])]) {
        citasMap.set(row.id, row);
      }
      const citas = [...citasMap.values()];
      const citaIds = citas.map((c) => c.id);

      const partesRes =
        citaIds.length > 0
          ? await supabase
              .from("partes_visita")
              .select("id, inmueble_direccion, fecha_visita, estado, created_at, cita_id")
              .in("cita_id", citaIds)
              .order("fecha_visita", { ascending: false })
              .limit(40)
          : {
              data: [] as Array<{
                id: string;
                inmueble_direccion: string | null;
                fecha_visita: string | null;
                estado: string;
                created_at: string | null;
              }>,
            };

      if (!vivo) return;

      const unidos = ordenarHistorial([
        ...citas.map(itemCita),
        ...(tareas.data ?? []).map(itemTarea),
        ...(inmuebles.data ?? []).map(itemInmueble),
        ...(demandas.data ?? []).map(itemDemanda),
        ...(facturas.data ?? []).map(itemFactura),
        ...(presupuestos.data ?? []).map(itemPresupuesto),
        ...(partesRes.data ?? []).map(itemParte),
      ]);
      setItems(unidos);
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [clienteId]);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Historial</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-neutral-500">Cargando historial…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Aún no hay visitas, tareas, inmuebles ni documentos ligados a este contacto.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-row)]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-start gap-3 py-3 hover:bg-[var(--surface-soft)]"
                >
                  <span className="mt-0.5 w-[7.25rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-dark)]">
                    {etiquetaTipoHistorial(item.tipo)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium leading-snug text-foreground">{item.titulo}</span>
                    <span className="mt-0.5 block text-[12.5px] text-[var(--text-2)]">{item.meta}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[12px] text-[var(--text-3)]">{fechaCorta(item.fecha)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
