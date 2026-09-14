"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  citasAgrupadasPorDia,
  citasDelDia,
  ESTADO_CITA_LABEL,
  horaCita,
  moverSemana,
  relacionUno,
  semanaDesde,
  TIPOS_CITA,
  TIPO_CITA_LABEL,
  type EstadoCita,
  type TipoCita,
} from "@/lib/citas/citas";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { CitaAcciones } from "@/components/citas/CitaAcciones";

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
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
};

export default function CalendarioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const [dia, setDia] = useState(() => hoy);
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoCita>("visita");
  const [hora, setHora] = useState("18:00");
  const [propiedadId, setPropiedadId] = useState(searchParams.get("propiedad") ?? "");
  const [clienteId, setClienteId] = useState(searchParams.get("cliente") ?? "");
  const [propiedades, setPropiedades] = useState<Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [filtroComercial, setFiltroComercial] = useState("");
  const semana = useMemo(() => semanaDesde(dia), [dia]);
  const etiquetaSemana = `${new Date(`${semana[0]}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  })} – ${new Date(`${semana[6]}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    const inicio = `${semana[0]}T00:00:00`;
    const fin = `${semana[6]}T23:59:59`;
    let q = supabase
      .from("citas")
      .select(
        "id, comercial_id, tipo, titulo, empieza, termina, propiedad_id, cliente_id, estado, profiles:comercial_id(nombre_completo, color), propiedades:propiedad_id(titulo, direccion, referencia)"
      )
      .gte("empieza", inicio)
      .lte("empieza", fin)
      .neq("estado", "cancelada")
      .order("empieza");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data }) =>
      setCitas(
        ((data ?? []) as Array<
          CitaRow & {
            profiles?: CitaRow["profiles"] | CitaRow["profiles"][];
            propiedades?: CitaRow["propiedades"] | CitaRow["propiedades"][];
          }
        >).map((row) => ({
          ...row,
          profiles: relacionUno(row.profiles),
          propiedades: relacionUno(row.propiedades),
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

  const cambiarEstado = async (id: string, estado: "hecha" | "cancelada") => {
    const supabase = createClient();
    const { error } = await supabase.from("citas").update({ estado }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar la cita.");
      return;
    }
    toast.success(estado === "hecha" ? "Cita marcada como hecha." : "Cita cancelada.");
    cargar();
  };

  const visibles = filtroComercial ? citas.filter((item) => item.comercial_id === filtroComercial) : citas;
  const porDia = useMemo(() => citasAgrupadasPorDia(visibles, semana), [visibles, semana]);
  const delDia = citasDelDia(visibles, dia);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Calendario" }]}
        title="Calendario"
        description="Semana del comercial. El parte de visita se hace desde la cita, no al revés."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/partes-visita">Visitas</Link>
          </Button>
        }
      />
      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={filtroComercial} onChange={setFiltroComercial} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setDia(moverSemana(dia, -1))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <p className="min-w-[9rem] text-center text-sm font-semibold capitalize">{etiquetaSemana}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => setDia(moverSemana(dia, 1))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => setDia(hoy)}>
          Hoy
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 md:hidden">
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
            {(porDia.get(d)?.length ?? 0) > 0 ? (
              <span className="ml-1 text-xs text-[#5D6B67]">{porDia.get(d)?.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-4 hidden gap-2 md:grid md:grid-cols-7">
        {semana.map((d) => {
          const esHoy = d === hoy;
          const seleccionado = d === dia;
          const lista = porDia.get(d) ?? [];
          return (
            <div
              key={d}
              className={`min-h-[14rem] rounded-2xl border p-2 ${
                seleccionado ? "border-[#0B7461] bg-[#E8F3EF]/40" : "border-[#E6E3DD] bg-white"
              }`}
            >
              <button type="button" onClick={() => setDia(d)} className="w-full text-left">
                <p className={`text-xs font-semibold uppercase tracking-wide ${esHoy ? "text-[#0B7461]" : "text-[#6B7A76]"}`}>
                  {new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" })}
                </p>
                <p className={`text-lg ${esHoy ? "font-semibold text-[#0B7461]" : "font-medium"}`}>
                  {new Date(`${d}T12:00:00`).getDate()}
                </p>
              </button>
              <ul className="mt-2 space-y-1.5">
                {lista.map((cita) => (
                  <li key={cita.id}>
                    <button
                      type="button"
                      onClick={() => setDia(d)}
                      className={`w-full rounded-lg border border-[#E6E3DD] bg-white px-2 py-1.5 text-left ${
                        cita.estado !== "prevista" ? "opacity-50" : ""
                      }`}
                    >
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5D6B67]">
                        <span className="h-2 w-2 rounded-full" style={{ background: cita.profiles?.color || "#3A6A82" }} />
                        {horaCita(cita.empieza)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs font-medium">{cita.titulo}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <form
        className="mt-6 grid gap-3 rounded-2xl border border-[#E6E3DD] bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <div className="sm:col-span-2">
          <Label>Nueva cita · {new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</Label>
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
            onChange={(e) => setTipo(e.target.value as TipoCita)}
            className="mt-1 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
          >
            {TIPOS_CITA.map((item) => (
              <option key={item} value={item}>
                {TIPO_CITA_LABEL[item]}
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

      <h2 className="mt-8 text-base font-semibold">
        {new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      <ul className="mt-3 space-y-2">
        {delDia.map((cita) => (
          <li
            key={cita.id}
            className={`flex flex-col gap-3 rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              cita.estado !== "prevista" ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: cita.profiles?.color || "#3A6A82" }} />
              <div>
                <p className="font-medium">{cita.titulo}</p>
                <p className="text-xs text-[#5D6B67]">
                  {horaCita(cita.empieza)}
                  {admin && cita.profiles?.nombre_completo ? ` · ${cita.profiles.nombre_completo}` : ""} ·{" "}
                  {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo} ·{" "}
                  {ESTADO_CITA_LABEL[(cita.estado as EstadoCita) ?? "prevista"] ?? cita.estado}
                </p>
                {cita.propiedad_id ? (
                  <Link href={`/propiedades/${cita.propiedad_id}`} className="mt-1 inline-block text-xs text-[#0B7461] underline-offset-2 hover:underline">
                    {[cita.propiedades?.referencia, cita.propiedades?.titulo || cita.propiedades?.direccion]
                      .filter(Boolean)
                      .join(" · ") || "Ver inmueble"}
                  </Link>
                ) : null}
              </div>
            </div>
            <CitaAcciones cita={cita} onEstado={cambiarEstado} />
          </li>
        ))}
        {delDia.length === 0 ? <li className="text-sm text-[#5D6B67]">No hay citas este día.</li> : null}
      </ul>
    </div>
  );
}
