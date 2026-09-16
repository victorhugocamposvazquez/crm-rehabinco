"use client";

import { useParams } from "next/navigation";
import { ParteVisitaEditor } from "@/components/partes-visita/ParteVisitaEditor";

export default function EditarParteVisitaPage() {
  const params = useParams();
  return <ParteVisitaEditor parteId={params.id as string} />;
}
