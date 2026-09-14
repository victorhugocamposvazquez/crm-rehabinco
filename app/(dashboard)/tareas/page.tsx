"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { relacionUno } from "@/lib/citas/citas";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import {
  agruparTareas,
  BANDEJAS_TAREA,
  recuentoTareas,
  type BandejaTarea,
} from "@/lib/tareas/tareas";

type FiltroBandeja = "ACTIVAS" | BandejaTarea;

type TareaRow = {
  id: string;
  comercial_id: string;
  titulo: string;
  vence: string | null;
  estado: string;
  finca_reference: string | null;
  propiedad_id: string | null;
  cliente_id: string | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
  clientes?: { nombre?: string | null } | null;
};

export default function TareasPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [filtro, setFiltro] = useState<FiltroBandeja>("ACTIVAS");
  const [titulo, setTitulo] = useState("");
  const [vence, setVence] = useState(hoy);
  const [propiedadId, setPropiedadId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [propiedades, setPropiedades] = useState<
    Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>
  >([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [filtroComercial, setFiltroComercial] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    let q = supabase
      .from("tareas")
      .select(
        "id, comercial_id, titulo, vence, estado, finca_reference, propiedad_id, cliente_id, propiedades:propiedad_id(titulo, direccion, referencia), clientes:cliente_id(nombre)"
      )
      .order("vence");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data }) => {
      setTareas(
        ((data ?? []) as Array<
          TareaRow & {
            propiedades?: TareaRow["propiedades"] | TareaRow["propiedades"][];
            clientes?: TareaRow["clientes"] | TareaRow["clientes"][];
          }
        >).map((row) => ({
          ...row,
          propiedades: relacionUno(row.propiedades),
          clientes: relacionUno(row.clientes),
        }))
      );
      setLoading(false);
    });
  };

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia")
      .eq("estado", "disponible")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => setPropiedades(data ?? []));
    void supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  useEffect(() => {
    if (!admin) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("id, nombre_completo, email, color")
      .in("role", ["comercial", "admin"])
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
  }, [admin]);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, admin]);

  const visibles = filtroComercial ? tareas.filter((item) => item.comercial_id === filtroComercial) : tareas;
  const grupos = useMemo(() => agruparTareas(visibles, hoy), [visibles, hoy]);
  const recuento = useMemo(() => recuentoTareas(visibles, hoy), [visibles, hoy]);

  const crear = async () => {
    if (!user) return;
    const tituloFinal = titulo.trim();
    if (!tituloFinal) {
      toast.error("Pon un título a la tarea.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("tareas").insert({
      comercial_id: user.id,
      titulo: tituloFinal,
      vence: vence || null,
      propiedad_id: propiedadId || null,
      cliente_id: clienteId || null,
    });
    if (error) {
      toast.error("No se ha podido crear la tarea.");
      return;
    }
    setTitulo("");
    toast.success("Tarea creada.");
    cargar();
  };

  const marcar = async (id: string, estado: "hecha" | "pendiente") => {
    const supabase = createClient();
    const { error } = await supabase.from("tareas").update({ estado }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar la tarea.");
      return;
    }
    setTareas((prev) => prev.map((item) => (item.id === id ? { ...item, estado } : item)));
  };

  const chips: Array<{ value: FiltroBandeja; label: string; count: number }> = [
    {
      value: "ACTIVAS",
      label: "Pendientes",
      count: recuento.VENCIDAS + recuento.HOY + recuento.PROXIMAS + recuento.SIN_FECHA,
    },
    ...BANDEJAS_TAREA.map((item) => ({ value: item.value, label: item.label, count: recuento[item.value] })),
  ];

  const secciones: BandejaTarea[] =
    filtro === "ACTIVAS"
      ? (["VENCIDAS", "HOY", "PROXIMAS", "SIN_FECHA"] as const).filter((clave) => grupos[clave].length > 0)
      : grupos[filtro].length > 0
        ? [filtro]
        : [];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Tareas" }]}
        title="Tareas"
        description="Follow-up del comercial: llamar, visitar, revisar. Lo de hoy también sale en la portada."
      />

      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={filtroComercial} onChange={setFiltroComercial} />
        </div>
      ) : null}

      <form
        className="mt-6 grid gap-3 rounded-2xl border border-[#E6E3DD] bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <div className="sm:col-span-2">
          <Label htmlFor="tarea-titulo">Nueva tarea</Label>
          <Input
            id="tarea-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Llamar al propietario de…"
          />
        </div>
        <div>
          <Label htmlFor="tarea-vence">Vence</Label>
          <Input id="tarea-vence" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tarea-inmueble">Inmueble</Label>
          <select
            id="tarea-inmueble"
            value={propiedadId}
            onChange={(e) => setPropiedadId(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
          >
            <option value="">Sin inmueble</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tarea-cliente">Cliente</Label>
          <select
            id="tarea-cliente"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            Añadir
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setFiltro(chip.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              filtro === chip.value ? "border-[#0B7461] bg-[#E8F3EF]" : "border-[#E6E3DD] bg-white"
            }`}
          >
            {chip.label} {chip.count}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {loading ? (
          <div className="flex min-h-[20vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
          </div>
        ) : null}

        {!loading && secciones.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <ListTodo className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
            <p className="text-base font-medium text-foreground">No hay tareas en esta bandeja</p>
          </Card>
        ) : null}

        {!loading &&
          secciones.map((clave) => (
            <section key={clave}>
              {filtro === "ACTIVAS" ? (
                <h2 className="mb-3 text-base font-semibold">
                  {BANDEJAS_TAREA.find((item) => item.value === clave)?.label ?? clave}
                </h2>
              ) : null}
              <ul className="space-y-2">
                {grupos[clave].map((tarea) => (
                  <li
                    key={tarea.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className={`font-medium ${tarea.estado === "hecha" ? "text-neutral-400 line-through" : ""}`}>
                        {tarea.titulo}
                      </p>
                      <p className="text-xs text-[#5D6B67]">
                        {tarea.vence ?? "Sin fecha"}
                        {tarea.propiedades
                          ? ` · ${[tarea.propiedades.referencia, tarea.propiedades.titulo || tarea.propiedades.direccion].filter(Boolean).join(" · ")}`
                          : ""}
                        {tarea.clientes?.nombre ? ` · ${tarea.clientes.nombre}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tarea.finca_reference ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link href={rutaFincaPersistida(tarea.finca_reference)}>Finca</Link>
                        </Button>
                      ) : null}
                      {tarea.propiedad_id ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/propiedades/${tarea.propiedad_id}`}>Inmueble</Link>
                        </Button>
                      ) : null}
                      {tarea.cliente_id ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/clientes/${tarea.cliente_id}`}>Cliente</Link>
                        </Button>
                      ) : null}
                      {tarea.estado === "hecha" ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void marcar(tarea.id, "pendiente")}>
                          Pendiente
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={() => void marcar(tarea.id, "hecha")}>
                          Hecha
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
