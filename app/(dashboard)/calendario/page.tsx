"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { citasDelDia, relacionUno, rutaNuevaVisitaDesdeCita, semanaDesde, TIPOS_CITA } from "@/lib/citas/citas";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";

type CitaRow = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  termina: string;
  propiedad_id: string | null;
  cliente_id: string | null;
  estado: string;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
};

export default function CalendarioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const admin = isAdmin(user?.role);
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("visita");
  const [hora, setHora] = useState("18:00");
  const [propiedadId, setPropiedadId] = useState(searchParams.get("propiedad") ?? "");
  const [clienteId, setClienteId] = useState(searchParams.get("cliente") ?? "");
  const [propiedades, setPropiedades] = useState<Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [filtroComercial, setFiltroComercial] = useState("");
  const semana = useMemo(() => semanaDesde(dia), [dia]);

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    const inicio = `${semana[0]}T00:00:00`;
    const fin = `${semana[6]}T23:59:59`;
    let q = supabase
      .from("citas")
      .select("id, comercial_id, tipo, titulo, empieza, termina, propiedad_id, cliente_id, estado, profiles:comercial_id(nombre_completo, color)")
      .gte("empieza", inicio)
      .lte("empieza", fin)
      .neq("estado", "cancelada")
      .order("empieza");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data }) =>
      setCitas(
        ((data ?? []) as Array<CitaRow & { profiles?: CitaRow["profiles"] | CitaRow["profiles"][] }>).map((row) => ({
          ...row,
          profiles: relacionUno(row.profiles),
        }))
      )
    );
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
  }, [user, admin, dia]);

  const crear = async () => {
    if (!user) return;
    const tituloFinal =
      titulo.trim() ||
      (propiedadId
        ? `Visita ${propiedades.find((p) => p.id === propiedadId)?.referencia || propiedades.find((p) => p.id === propiedadId)?.direccion || ""}`.trim()
        : "");
    if (!tituloFinal) {
      toast.error("Pon un título o elige un inmueble.");
      return;
    }
    const empieza = new Date(`${dia}T${hora}:00`);
    const termina = new Date(empieza.getTime() + 60 * 60 * 1000);
    const supabase = createClient();
    const { error } = await supabase.from("citas").insert({
      comercial_id: user.id,
      tipo,
      titulo: tituloFinal,
      empieza: empieza.toISOString(),
      termina: termina.toISOString(),
      propiedad_id: propiedadId || null,
      cliente_id: clienteId || null,
    });
    if (error) {
      toast.error("No se ha podido crear la cita.");
      return;
    }
    setTitulo("");
    toast.success("Cita creada.");
    cargar();
  };

  const visibles = filtroComercial ? citas.filter((item) => item.comercial_id === filtroComercial) : citas;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Calendario" }]}
        title="Calendario"
        description="Citas del equipo. El parte de visita se hace desde la cita, no al revés."
      />
      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={filtroComercial} onChange={setFiltroComercial} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {semana.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDia(d)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              d === dia ? "border-[#0B7461] bg-[#E8F3EF] font-semibold" : "border-[#E6E3DD] bg-white"
            }`}
          >
            {new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
          </button>
        ))}
      </div>

      <form
        className="mt-6 grid gap-3 rounded-2xl border border-[#E6E3DD] bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <div className="sm:col-span-2">
          <Label>Nueva cita</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Visita en… (opcional si eliges inmueble)" />
        </div>
        <div>
          <Label>Inmueble</Label>
          <select
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
        <div>
          <Label>Cliente (demandante)</Label>
          <select
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
        <div>
          <Label>Tipo</Label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
          >
            {TIPOS_CITA.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Hora</Label>
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            Añadir
          </Button>
        </div>
      </form>

      <ul className="mt-6 space-y-2">
        {citasDelDia(visibles, dia).map((cita) => (
          <li key={cita.id} className="flex items-center justify-between rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: cita.profiles?.color || "#3A6A82" }} />
              <div>
                <p className="font-medium">{cita.titulo}</p>
                <p className="text-xs text-[#5D6B67]">
                  {new Date(cita.empieza).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  {admin && cita.profiles?.nombre_completo ? ` · ${cita.profiles.nombre_completo}` : ""} · {cita.tipo}
                </p>
              </div>
            </div>
            {cita.tipo === "visita" ? (
              <Button asChild size="sm">
                <Link href={rutaNuevaVisitaDesdeCita({ id: cita.id, propiedadId: cita.propiedad_id })}>Hacer parte</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
