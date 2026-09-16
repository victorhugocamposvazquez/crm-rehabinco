"use client";

import { useParams } from "next/navigation";
import { ContratoArrasEditor } from "@/components/contratos-arras/ContratoArrasEditor";

export default function ContratoArrasPage() {
  const params = useParams();
  return <ContratoArrasEditor contratoId={params.id as string} />;
}
