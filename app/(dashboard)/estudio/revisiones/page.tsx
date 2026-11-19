import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarcarRevisionVista } from "@/components/estudio/RevisionesEstudio";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { FORMATS, type FormatId } from "@/lib/estudio/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Relacion<T> = T | T[] | null;

function uno<T>(valor: Relacion<T>): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

function cuando(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

export default async function RevisionesEstudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: perfil }, { data }] = await Promise.all([
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("estudio_revisiones")
      .select("id, nota, formato, estado, created_at, propiedad_id, profiles(nombre_completo), propiedades(referencia, localidad)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const direccion = isAdmin(parseRole(perfil?.role));
  const filas = data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 min-[820px]:px-8">
      <PageHeader
        breadcrumb={[{ label: "Revisiones" }]}
        title="Revisiones de diseño"
        description={
          direccion
            ? "El editor de marketing pide aquí la revisión. De momento el aviso llega solo a Hugo."
            : "Lo que has enviado a Hugo."
        }
      />
      {filas.length === 0 ? (
        <p className="mt-8 text-[14px] text-[var(--text-2)]">Todavía no hay solicitudes.</p>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          {filas.map((fila) => {
            const autor = uno(fila.profiles as Relacion<{ nombre_completo: string | null }>);
            const piso = uno(fila.propiedades as Relacion<{ referencia: string | null; localidad: string | null }>);
            const tipo = fila.formato in FORMATS ? FORMATS[fila.formato as FormatId].label : fila.formato;
            const ref = piso?.referencia?.trim() || "Sin referencia";
            return (
              <li key={fila.id} className="flex flex-col gap-3 px-4 py-4 min-[820px]:flex-row min-[820px]:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {ref}
                    {piso?.localidad ? <span className="font-normal text-[var(--text-2)]"> · {piso.localidad}</span> : null}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--text-2)]">
                    {autor?.nombre_completo?.trim() || "Marketing"} · {tipo} · {cuando(fila.created_at)}
                    {fila.estado === "vista" ? " · Vista" : " · Pendiente"}
                  </p>
                  {fila.nota ? <p className="mt-2 text-[14px]">{fila.nota}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/estudio/revisiones/${fila.id}`}
                    className="inline-flex h-9 items-center rounded-lg bg-[var(--accent)] px-3 text-[13px] font-semibold text-[var(--accent-foreground)]"
                  >
                    Ver diseño
                  </Link>
                  {direccion && fila.estado === "pendiente" ? <MarcarRevisionVista id={fila.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
