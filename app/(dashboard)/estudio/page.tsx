import "@/components/estudio/estudio.css";
import { EstudioCliente } from "@/components/estudio/EstudioCliente";
import { cargarEstudio } from "@/lib/estudio/cargar";

export const dynamic = "force-dynamic";

export default async function EstudioPage({
  searchParams,
}: {
  searchParams: Promise<{ inmueble?: string }>;
}) {
  const params = await searchParams;
  const { inmuebles, agencia } = await cargarEstudio();
  const elegido = params.inmueble && inmuebles.some((item) => item.id === params.inmueble) ? params.inmueble : undefined;
  return (
    <div className="estudio-page dark">
      <EstudioCliente inmuebles={inmuebles} initialInmuebleId={elegido} agencia={agencia} />
    </div>
  );
}
