import { EncargoDetalle } from "@/components/captacion/EncargoDetalle";

export default async function EncargoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EncargoDetalle id={id} />;
}
