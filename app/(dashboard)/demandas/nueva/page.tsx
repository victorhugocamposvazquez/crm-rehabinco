import { redirect } from "next/navigation";

export default async function NuevaDemandaRedirect({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams({ nueva: "1" });
  if (params.cliente) q.set("cliente", params.cliente);
  redirect(`/demandas?${q.toString()}`);
}
