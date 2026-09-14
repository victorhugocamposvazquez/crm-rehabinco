"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIPOS_INMUEBLE, TIPO_INMUEBLE_LABEL } from "@/lib/inmuebles/catalogo";
import { TIPOS_OPERACION_DEMANDA } from "@/lib/demandas/matching";

export default function NuevaDemandaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [clienteId, setClienteId] = useState(searchParams.get("cliente") ?? "");
  const [tipoOperacion, setTipoOperacion] = useState("compra");
  const [zonas, setZonas] = useState("");
  const [presupuestoMax, setPresupuestoMax] = useState("");
  const [superficieMin, setSuperficieMin] = useState("");
  const [habitacionesMin, setHabitacionesMin] = useState("3");
  const [tipos, setTipos] = useState<string[]>(["piso"]);
  const [requisitos, setRequisitos] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  const crear = async () => {
    if (!user || !clienteId) {
      toast.error("Elige un cliente.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("demandas")
      .insert({
        cliente_id: clienteId,
        comercial_id: user.id,
        tipo_operacion: tipoOperacion,
        tipos_inmueble: tipos,
        zonas: zonas
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        presupuesto_max: presupuestoMax ? Number(presupuestoMax) : null,
        superficie_min: superficieMin ? Number(superficieMin) : null,
        habitaciones_min: habitacionesMin ? Number(habitacionesMin) : null,
        requisitos: requisitos || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("No se ha podido crear la demanda.");
      return;
    }
    router.push(`/demandas/${data.id}`);
  };

  return (
    <div>
      <PageHeader breadcrumb={[{ label: "Demandas", href: "/demandas" }, { label: "Nueva" }]} title="Nueva demanda" />
      <form
        className="mt-6 max-w-xl space-y-4 rounded-2xl border border-[#E6E3DD] bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <div>
          <Label>Cliente</Label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">Selecciona</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Operación</Label>
          <select
            value={tipoOperacion}
            onChange={(e) => setTipoOperacion(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border px-3 text-sm"
          >
            {TIPOS_OPERACION_DEMANDA.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Tipos</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {TIPOS_INMUEBLE.map((tipo) => (
              <label key={tipo} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={tipos.includes(tipo)}
                  onChange={(e) =>
                    setTipos((prev) => (e.target.checked ? [...prev, tipo] : prev.filter((item) => item !== tipo)))
                  }
                />
                {TIPO_INMUEBLE_LABEL[tipo]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label>Zonas (separadas por coma)</Label>
          <Input value={zonas} onChange={(e) => setZonas(e.target.value)} placeholder="Oleiros, A Coruña" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Presupuesto máx.</Label>
            <Input value={presupuestoMax} onChange={(e) => setPresupuestoMax(e.target.value)} />
          </div>
          <div>
            <Label>m² mín.</Label>
            <Input value={superficieMin} onChange={(e) => setSuperficieMin(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Habitaciones mín.</Label>
          <Input value={habitacionesMin} onChange={(e) => setHabitacionesMin(e.target.value)} />
        </div>
        <div>
          <Label>Requisitos</Label>
          <Input value={requisitos} onChange={(e) => setRequisitos(e.target.value)} placeholder="Con ascensor…" />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Crear demanda"}
        </Button>
      </form>
    </div>
  );
}
