"use client";

import { useParams } from "next/navigation";
import { DemandaCruce } from "@/components/demandas/cruce/DemandaCruce";

export default function DemandaDetallePage() {
  const params = useParams();
  return <DemandaCruce id={String(params.id ?? "")} />;
}
