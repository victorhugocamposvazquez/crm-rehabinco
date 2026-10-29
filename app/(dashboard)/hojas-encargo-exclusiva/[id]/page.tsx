"use client";

import { useParams } from "next/navigation";
import { HojaEncargoExclusivaEditor } from "@/components/hojas-encargo-exclusiva/HojaEncargoExclusivaEditor";

export default function EncargoExclusivaPage() {
  const params = useParams();
  return <HojaEncargoExclusivaEditor documentoId={params.id as string} />;
}
