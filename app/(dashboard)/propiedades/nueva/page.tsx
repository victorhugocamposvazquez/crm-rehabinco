import { redirect } from "next/navigation";

export default async function NuevaPropiedadRedirect({
  searchParams,
}: {
  searchParams: Promise<{ ofertante?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams({ nueva: "1" });
  if (params.ofertante) q.set("ofertante", params.ofertante);
  redirect(`/propiedades?${q.toString()}`);
}
