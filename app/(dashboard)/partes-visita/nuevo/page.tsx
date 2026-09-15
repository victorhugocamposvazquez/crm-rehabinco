import { redirect } from "next/navigation";

export default async function NuevoParteRedirect({
  searchParams,
}: {
  searchParams: Promise<{ propiedad?: string; propiedadId?: string; cita?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams({ nueva: "1" });
  const propiedad = params.propiedad ?? params.propiedadId;
  if (propiedad) q.set("propiedad", propiedad);
  if (params.cita) q.set("cita", params.cita);
  redirect(`/partes-visita?${q.toString()}`);
}
