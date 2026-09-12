import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params ?? {})) {
    if (typeof valor === "string" && valor) qs.set(clave, valor);
    else if (Array.isArray(valor) && valor[0]) qs.set(clave, valor[0]);
  }
  const serializado = qs.toString();
  redirect(serializado ? `/catastro?${serializado}` : "/catastro");
}
