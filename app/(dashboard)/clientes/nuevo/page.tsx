import { redirect } from "next/navigation";

export default async function NuevoClienteRedirect({
  searchParams,
}: {
  searchParams: Promise<{ padre?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams({ nueva: "1" });
  if (params.padre) q.set("padre", params.padre);
  redirect(`/clientes?${q.toString()}`);
}
