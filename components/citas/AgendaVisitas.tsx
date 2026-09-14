"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { Card } from "@/components/ui/card";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { FichaLink } from "@/components/crm/FichaPeek";
import { ESTADO_CITA_LABEL, horaCita, relacionUno, type EstadoCita } from "@/lib/citas/citas";

type CitaAgenda = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  propiedad_id: string | null;
  cliente_id: string | null;
  estado: string;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
  clientes?: { nombre?: string | null } | null;
};

export function AgendaVisitas({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const [citas, setCitas] = useState<CitaAgenda[]>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [filtroComercial, setFiltroComercial] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    let q = supabase
      .from("citas")
      .select(
        "id, comercial_id, tipo, titulo, empieza, propiedad_id, cliente_id, estado, profiles:comercial_id(nombre_completo, color), propiedades:propiedad_id(titulo, direccion, referencia), clientes:cliente_id(nombre)"
      )
      .eq("tipo", "visita")
      .neq("estado", "cancelada")
      .order("empieza");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data }) => {
      setCitas(
        ((data ?? []) as Array<
          CitaAgenda & {
            profiles?: CitaAgenda["profiles"] | CitaAgenda["profiles"][];
            propiedades?: CitaAgenda["propiedades"] | CitaAgenda["propiedades"][];
            clientes?: CitaAgenda["clientes"] | CitaAgenda["clientes"][];
          }
        >).map((row) => ({
          ...row,
          profiles: relacionUno(row.profiles),
          propiedades: relacionUno(row.propiedades),
          clientes: relacionUno(row.clientes),
        }))
      );
      setLoading(false);
    });
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, admin]);

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

  const visibles = filtroComercial ? citas.filter((item) => item.comercial_id === filtroComercial) : citas;
  const previstas = useMemo(
    () => visibles.filter((item) => item.estado === "prevista"),
    [visibles]
  );
  const semana = new Date();
  semana.setDate(semana.getDate() + 7);
  const hasta = semana.toISOString().slice(0, 10);
  const atrasadas = previstas.filter((item) => item.empieza.slice(0, 10) < hoy);
  const proximas = previstas.filter((item) => {
    const dia = item.empieza.slice(0, 10);
    if (compact) return dia >= hoy && dia <= hasta;
    return dia >= hoy;
  });

  const cambiarEstado = async (id: string, estado: "hecha" | "cancelada") => {
    const supabase = createClient();
    const { error } = await supabase.from("citas").update({ estado }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar la cita.");
      return;
    }
    toast.success(estado === "hecha" ? "Visita marcada como hecha." : "Visita cancelada.");
    cargar();
  };

  if (loading) {
    return (
      <div className={compact ? "px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]" : "flex min-h-[30vh] items-center justify-center"}>
        {compact ? "Cargando visitas…" : <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />}
      </div>
    );
  }

  return (
    <div className={compact ? "" : "space-y-6"}>
      {admin && !compact ? <FiltroComercial comerciales={comerciales} valor={filtroComercial} onChange={setFiltroComercial} /> : null}
      {!compact && atrasadas.length > 0 ? (
        <ListaGrupo titulo="Atrasadas" citas={atrasadas} admin={admin} onEstado={cambiarEstado} />
      ) : null}
      <ListaGrupo
        titulo={compact ? undefined : "Próximas"}
        citas={proximas}
        admin={admin}
        onEstado={cambiarEstado}
        vacio="No hay visitas previstas."
        compact={compact}
      />
    </div>
  );
}

function ListaGrupo({
  titulo,
  citas,
  admin,
  onEstado,
  vacio,
  compact,
}: {
  titulo?: string;
  citas: CitaAgenda[];
  admin: boolean;
  onEstado: (id: string, estado: "hecha" | "cancelada") => void;
  vacio?: string;
  compact?: boolean;
}) {
  if (compact) {
    if (citas.length === 0) {
      return <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">{vacio}</p>;
    }
    return (
      <ul>
        {citas.map((cita) => {
          const d = new Date(`${cita.empieza.slice(0, 10)}T12:00:00`);
          return (
            <li key={cita.id} className="flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5">
              <div className="w-[46px] shrink-0 rounded-lg border border-border py-1 text-center leading-tight">
                <div className="text-[10px] uppercase tracking-[.06em] text-[var(--label)]">
                  {d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}
                </div>
                <div className="text-[16px] font-semibold">{d.getDate()}</div>
              </div>
              <span className="h-9 w-[3px] rounded-sm" style={{ background: cita.profiles?.color || "#3A6A82" }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{cita.titulo}</div>
                <div className="mt-0.5 text-[12px] text-[var(--text-2)]">
                  {horaCita(cita.empieza)}
                  {cita.clientes?.nombre ? ` · ${cita.clientes.nombre}` : ""}
                </div>
              </div>
              <CitaAcciones cita={cita} onEstado={onEstado} compact />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section>
      {titulo ? <h2 className="mb-3 text-base font-semibold">{titulo}</h2> : null}
      {citas.length === 0 && vacio ? (
        <Card className="px-6 py-10 text-center text-sm text-neutral-500">{vacio}</Card>
      ) : (
        <ul className="space-y-2">
          {citas.map((cita) => (
            <li
              key={cita.id}
              className="flex flex-col gap-3 rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: cita.profiles?.color || "#3A6A82" }} />
                <div>
                  <p className="font-medium">{cita.titulo}</p>
                  <p className="text-xs text-[#5D6B67]">
                    {new Date(`${cita.empieza.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {horaCita(cita.empieza)}
                    {admin && cita.profiles?.nombre_completo ? ` · ${cita.profiles.nombre_completo}` : ""}
                    {` · ${ESTADO_CITA_LABEL[(cita.estado as EstadoCita) ?? "prevista"] ?? cita.estado}`}
                  </p>
                  <p className="mt-1 text-xs text-[#5D6B67]">
                    {cita.propiedad_id && cita.propiedades ? (
                      <FichaLink tipo="propiedad" id={cita.propiedad_id} className="text-inherit">
                        {[cita.propiedades.referencia, cita.propiedades.titulo || cita.propiedades.direccion]
                          .filter(Boolean)
                          .join(" · ")}
                      </FichaLink>
                    ) : null}
                    {cita.clientes?.nombre && cita.cliente_id ? (
                      <>
                        {cita.propiedades ? " · " : ""}
                        <FichaLink tipo="cliente" id={cita.cliente_id} className="text-inherit">
                          {cita.clientes.nombre}
                        </FichaLink>
                      </>
                    ) : cita.clientes?.nombre ? (
                      ` · ${cita.clientes.nombre}`
                    ) : (
                      ""
                    )}
                  </p>
                </div>
              </div>
              <CitaAcciones cita={cita} onEstado={onEstado} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
