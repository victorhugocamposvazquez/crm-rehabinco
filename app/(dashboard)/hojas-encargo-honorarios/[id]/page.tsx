"use client";

import { useParams } from "next/navigation";
import { HojaEncargoHonorariosEditor } from "@/components/hojas-encargo-honorarios/HojaEncargoHonorariosEditor";

export default function HojaEncargoPage() {
  const params = useParams();
  return <HojaEncargoHonorariosEditor documentoId={params.id as string} />;
}
