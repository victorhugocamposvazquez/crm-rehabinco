import "@/components/estudio/estudio.css";
import { EstudioCliente } from "@/components/estudio/EstudioCliente";
import { cargarEstudio } from "@/lib/estudio/cargar";
import { publicacionGuardada } from "@/lib/estudio/revision";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EstudioPage({
  searchParams,
}: {
  searchParams: Promise<{ inmueble?: string; revision?: string }>;
}) {
  const params = await searchParams;
  const { inmuebles, agencia } = await cargarEstudio();
  const elegido = params.inmueble && inmuebles.some((item) => item.id === params.inmueble) ? params.inmueble : undefined;
  let inicial = undefined;
  if (params.revision && elegido) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("estudio_revisiones")
      .select("propiedad_id, publicacion")
      .eq("id", params.revision)
      .maybeSingle();
    if (data?.propiedad_id === elegido) inicial = publicacionGuardada(data.publicacion) ?? undefined;
  }
  return (
    <div className="estudio-page">
      <EstudioCliente inmuebles={inmuebles} initialInmuebleId={elegido} agencia={agencia} inicial={inicial} />
    </div>
  );
}
