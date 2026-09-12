import { FincaPersistida } from "@/components/catastro/FincaPersistida";

export default async function CatastroFincaPage({
  params,
}: {
  params: Promise<{ fincaReference: string }>;
}) {
  const { fincaReference } = await params;
  return <FincaPersistida fincaReference={fincaReference} />;
}
