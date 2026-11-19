import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DecisionRevision } from "@/components/estudio/RevisionesEstudio";
import { VistaRevision } from "@/components/estudio/VistaRevision";
import { isMarketing, isSuperAdmin, parseRole } from "@/lib/auth/roles";
import { FORMATS, type FormatId } from "@/lib/estudio/config";
import { mapearInmuebleEstudio, type AgenteFila, type FilaEstudio, type FotoFila } from "@/lib/estudio/mapear";
import { publicacionGuardada } from "@/lib/estudio/revision";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Relacion<T> = T | T[] | null;

function uno<T>(valor: Relacion<T>): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

export default async function RevisionEstudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: perfil }, { data: fila }] = await Promise.all([
    user ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("estudio_revisiones")
      .select("id, nota, formato, estado, motivo, created_at, propiedad_id, publicacion, profiles(nombre_completo)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!fila) notFound();
  const pub = publicacionGuardada(fila.publicacion);
  if (!pub) notFound();

  const { data: propiedad } = await supabase
    .from("propiedades")
    .select("id, referencia, titulo, direccion, localidad, tipo_operacion, precio_venta, precio_alquiler, superficie_m2, superficie_construida, habitaciones, banos, certificado_energetico, comercial_id, user_id")
    .eq("id", fila.propiedad_id)
    .maybeSingle();
  if (!propiedad) notFound();
  const agenteId = propiedad.comercial_id || propiedad.user_id;
  const [{ data: fotos }, { data: agente }] = await Promise.all([
    supabase.from("inmueble_media").select("id, propiedad_id, url, orden").eq("propiedad_id", propiedad.id).eq("tipo", "foto").order("orden"),
    agenteId ? supabase.from("profiles").select("id, nombre_completo, color").eq("id", agenteId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const inm = mapearInmuebleEstudio(propiedad as FilaEstudio, (fotos ?? []) as FotoFila[], (agente ?? null) as AgenteFila | null);
  const role = parseRole(perfil?.role);
  const autor = uno(fila.profiles as Relacion<{ nombre_completo: string | null }>);
  const tipo = fila.formato in FORMATS ? FORMATS[fila.formato as FormatId].label : fila.formato;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 min-[820px]:px-8">
      <PageHeader
        breadcrumb={[{ label: "Revisiones", href: "/estudio/revisiones" }, { label: inm.ref }]}
        title={inm.titulo}
        description={`${autor?.nombre_completo?.trim() || "Marketing"} pide revisión · ${tipo}${fila.nota ? ` · ${fila.nota}` : ""}`}
        actions={
          isMarketing(role) ? (
            <Link
              href={`/estudio?inmueble=${inm.id}&revision=${fila.id}`}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-[13px] font-semibold"
            >
              Seguir en el Estudio
            </Link>
          ) : null
        }
      />
      <div className="mt-6">
        <VistaRevision inm={inm} pub={pub} />
      </div>
      <DecisionRevision id={fila.id} estado={fila.estado} motivo={fila.motivo ?? ""} puedeDecidir={isSuperAdmin(role)} />
    </div>
  );
}
