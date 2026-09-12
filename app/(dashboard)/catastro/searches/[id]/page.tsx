import { BusquedaHistorica } from "@/components/catastro/BusquedaHistorica";

export default async function CatastroBusquedaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BusquedaHistorica searchId={id} />;
}
