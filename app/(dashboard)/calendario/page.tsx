"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { citasDelDia, relacionUno, rutaNuevaVisitaDesdeCita, semanaDesde, TIPOS_CITA } from "@/lib/citas/citas";

type CitaRow = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  termina: string;
  propiedad_id: string | null;
  estado: string;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
};

export default function CalendarioPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("visita");
  const [hora, setHora] = useState("18:00");
  const semana = useMemo(() => semanaDesde(dia), [dia]);

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    const inicio = `${semana[0]}T00:00:00`;
    const fin = `${semana[6]}T23:59:59`;
    let q = supabase
      .from("citas")
      .select("id, comercial_id, tipo, titulo, empieza, termina, propiedad_id, estado, profiles:comercial_id(nombre_completo, color)")
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
    cargar();
    // semana se deriva de dia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, admin, dia]);

  const crear = async () => {
    if (!user || !titulo.trim()) return;
    const empieza = new Date(`${dia}T${hora}:00`);
    const termina = new Date(empieza.getTime() + 60 * 60 * 1000);
    const supabase = createClient();
    const { error } = await supabase.from("citas").insert({
      comercial_id: user.id,
      tipo,
      titulo: titulo.trim(),
      empieza: empieza.toISOString(),
      termina: termina.toISOString(),
    });
    if (error) {
      toast.error("No se ha podido crear la cita.");
      return;
    }
    setTitulo("");
    toast.success("Cita creada.");
    cargar();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Calendario" }]}
        title="Calendario"
        description="Citas del equipo. El parte de visita se hace desde la cita, no al revés."
      />
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
        className="mt-6 grid gap-3 rounded-2xl border border-[#E6E3DD] bg-white p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <div className="sm:col-span-2">
          <Label>Nueva cita</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Visita en…" />
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
        <div className="sm:col-span-4">
          <Button type="submit" size="sm">
            Añadir
          </Button>
        </div>
      </form>

      <ul className="mt-6 space-y-2">
        {citasDelDia(citas, dia).map((cita) => (
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
