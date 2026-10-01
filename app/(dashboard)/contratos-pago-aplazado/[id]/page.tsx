"use client";

import { useParams } from "next/navigation";
import { ContratoPagoAplazadoEditor } from "@/components/contratos-pago-aplazado/ContratoPagoAplazadoEditor";

export default function PagoAplazadoPage() {
  const params = useParams();
  return <ContratoPagoAplazadoEditor contratoId={params.id as string} />;
}
