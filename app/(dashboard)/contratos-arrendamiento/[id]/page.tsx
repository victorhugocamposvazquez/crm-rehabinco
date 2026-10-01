"use client";

import { useParams } from "next/navigation";
import { ContratoArrendamientoEditor } from "@/components/contratos-arrendamiento/ContratoArrendamientoEditor";

export default function ArrendamientoPage() {
  const params = useParams();
  return <ContratoArrendamientoEditor contratoId={params.id as string} />;
}
