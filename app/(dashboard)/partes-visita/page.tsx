"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, puedeVerPapelera } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { BotonPapeleraDocumento } from "@/components/documentos/BotonPapeleraDocumento";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Plus, Trash2 } from "lucide-react";
import { AgendaVisitas } from "@/components/citas/AgendaVisitas";
import { ESTADO_PARTE_LABELS, buildPublicFirmaUrl } from "@/lib/partes-visita";
import { colorEstado } from "@/lib/ui/estados-vista";
import { extraAlta } from "@/lib/ui/alta-panel";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";

type ParteRow = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  visitante_nombre: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  hora_visita: string | null;
  estado: "borrador" | "pendiente_firma" | "firmado";
  agente_nombre: string | null;
  token: string | null;
  creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

export default function PartesVisitaPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const verPapelera = puedeVerPapelera(user?.role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<"todos" | ParteRow["estado"]>("todos");
  const [partes, setPartes] = useState<ParteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hayBorrador = useHayAltaBorrador("parte");

  useEffect(() => {
    const extra = extraAlta(searchParams);
    if (!extra) return;
    const q = extra.toString();
    router.replace(q ? `/partes-visita/nuevo?${q}` : "/partes-visita/nuevo");
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("partes_visita")
      .select(
        "id, user_id, comercial_id, visitante_nombre, inmueble_direccion, fecha_visita, hora_visita, estado, agente_nombre, token, creador:comercial_id(nombre_completo, color, email)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPartes([]);
        } else {
          setPartes(
            ((data ?? []) as Array<ParteRow & { creador?: ParteRow["creador"] | ParteRow["creador"][] }>).map((row) => ({
              ...row,
              creador: relacionUno(row.creador),
            }))
          );
        }
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return partes.filter((p) => filterEstado === "todos" || p.estado === filterEstado);
  }, [partes, filterEstado]);

  const copiarFirma = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildPublicFirmaUrl(token));
      toast.success("Enlace de firma copiado.");
    } catch {
      toast.error("No se ha podido copiar el enlace.");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Herramientas", href: "/herramientas" },
          { label: "Visitas" },
        ]}
        title="Visitas"
        description={
          admin
            ? "Partes de todo el equipo. Cada fila indica quién lo creó."
            : "Tus partes de visita. La agenda es la cita; el parte es el PDF que se rellena y firma."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {verPapelera ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/partes-visita/papelera" className="gap-2">
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  Papelera
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link href="/calendario">Concertar visita</Link>
            </Button>
            <Button asChild size="sm" className="hidden min-[820px]:inline-flex">
              <Link href="/partes-visita/nuevo" className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                {hayBorrador ? "Continuar borrador" : "Nuevo parte"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mt-5 flex flex-wrap items-start gap-4">
        <section className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[14px] border border-border bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
            <h2 className="text-[15px] font-semibold">Próximas visitas</h2>
            <span className="text-[12px] text-[var(--text-2)]">Esta semana</span>
          </div>
          <div className="px-0">
            <AgendaVisitas compact />
          </div>
        </section>

        <section className="min-w-0 flex-[1_1_420px] overflow-hidden rounded-[14px] border border-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-4 py-3">
            <h2 className="flex-1 text-[15px] font-semibold">Partes</h2>
            {(["todos", "pendiente_firma", "firmado", "borrador"] as const).map((e) => (
              <Chip key={e} active={filterEstado === e} onClick={() => setFilterEstado(e)}>
                {e === "todos" ? "Todos" : ESTADO_PARTE_LABELS[e]}
              </Chip>
            ))}
          </div>

          {error ? <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {loading ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]">Cargando partes…</p>
          ) : filtered.length === 0 ? (
            <div>
              <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">
                {partes.length === 0 ? "Aún no hay partes de visita." : "No hay resultados con ese filtro."}
              </p>
              {partes.length === 0 ? (
                <div className="flex justify-center pb-6">
                  <Button asChild size="sm">
                    <Link href="/partes-visita/nuevo" className="gap-2">
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      {hayBorrador ? "Continuar borrador" : "Nuevo parte"}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                <Link href={`/partes-visita/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{p.visitante_nombre || "Visitante"}</div>
                    <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                      {[p.inmueble_direccion, p.fecha_visita].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <CreadorDocumento
                    userId={p.user_id}
                    comercialId={p.comercial_id}
                    creador={p.creador}
                    viewerId={user?.id}
                    admin={admin}
                  />
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px]" style={{ color: colorEstado(p.estado) }}>
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: colorEstado(p.estado) }} />
                    {ESTADO_PARTE_LABELS[p.estado]}
                  </div>
                </Link>
                {p.estado === "pendiente_firma" && p.token ? (
                  <button
                    type="button"
                    onClick={() => void copiarFirma(p.token!)}
                    className="h-[30px] shrink-0 whitespace-nowrap rounded-lg bg-accent px-2.5 text-[12px] font-semibold text-white hover:bg-accent-dark"
                  >
                    Enlace
                  </button>
                ) : null}
                <BotonPapeleraDocumento
                  id={p.id}
                  tipo="parte_visita"
                  onEliminado={(id) => setPartes((prev) => prev.filter((item) => item.id !== id))}
                />
              </div>
            ))
          )}
        </section>
      </div>

      <Fab href="/partes-visita/nuevo" label={hayBorrador ? "Continuar borrador" : "Nuevo parte"} />
    </div>
  );
}
