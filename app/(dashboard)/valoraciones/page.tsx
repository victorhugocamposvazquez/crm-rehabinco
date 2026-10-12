"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { createClient } from "@/lib/supabase/client";

type Fila = {
  id: string;
  created_at: string;
  confidence: number;
  value_mid: number;
  channel: string;
  created_by: string | null;
  property: { formatted_address: string | null; main_type: string | null; built_surface: number | null } | null;
  comercial: string | null;
};

const PAGE = 20;

export default function ValoracionesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pagina = Math.max(1, Number(params.get("pagina") || 1));
  const canal = params.get("canal") || "";
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const desde = (pagina - 1) * PAGE;
    let q = supabase
      .from("avm_valuations")
      .select("id, created_at, confidence, value_mid, channel, created_by, avm_properties(formatted_address, main_type, built_surface)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(desde, desde + PAGE - 1);
    if (canal) q = q.eq("channel", canal);
    void q.then(async ({ data, count }) => {
      const ids = [...new Set((data ?? []).map((r) => r.created_by).filter(Boolean))] as string[];
      const nombres = new Map<string, string>();
      if (ids.length) {
        const { data: perfiles } = await supabase.from("profiles").select("id, nombre_completo").in("id", ids);
        for (const p of perfiles ?? []) nombres.set(p.id, p.nombre_completo ?? "");
      }
      setTotal(count ?? 0);
      setFilas((data ?? []).map((r) => {
        const property = Array.isArray(r.avm_properties) ? r.avm_properties[0] : r.avm_properties;
        return {
          id: r.id,
          created_at: r.created_at,
          confidence: r.confidence,
          value_mid: r.value_mid,
          channel: r.channel,
          created_by: r.created_by,
          property: property ?? null,
          comercial: r.created_by ? nombres.get(r.created_by) ?? null : null,
        };
      }));
    });
  }, [pagina, canal]);

  const paginas = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <PageHeader
        title="Valoraciones"
        actions={<Button asChild size="sm"><Link href="/valoraciones/nueva">Nueva valoración</Link></Button>}
      />
      <ValoracionesNav actual="/valoraciones" />
      <div className="mb-3 flex gap-2 text-[13px]">
        {["", "crm", "landing"].map((c) => (
          <button key={c || "todas"} type="button" className={canal === c ? "font-medium" : "text-[var(--text-3)]"} onClick={() => router.push(c ? `/valoraciones?canal=${c}` : "/valoraciones")}>
            {c || "Todas"}
          </button>
        ))}
      </div>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[var(--text-3)]">
            <th className="py-2 pr-3 font-medium">Dirección</th>
            <th className="py-2 pr-3 font-medium">Tipo</th>
            <th className="py-2 pr-3 font-medium">m²</th>
            <th className="py-2 pr-3 font-medium">Valor</th>
            <th className="py-2 pr-3 font-medium">Confianza</th>
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Comercial</th>
            <th className="py-2 font-medium">Canal</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-[var(--border)]">
              <td className="py-2 pr-3"><Link href={`/valoraciones/${f.id}`} className="underline-offset-2 hover:underline">{f.property?.formatted_address || "Sin dirección"}</Link></td>
              <td className="py-2 pr-3">{f.property?.main_type || "—"}</td>
              <td className="py-2 pr-3 tabular-nums">{f.property?.built_surface ?? "—"}</td>
              <td className="py-2 pr-3 tabular-nums">{Number(f.value_mid).toLocaleString("es-ES")} €</td>
              <td className="py-2 pr-3 tabular-nums">{f.confidence} %</td>
              <td className="py-2 pr-3">{new Date(f.created_at).toLocaleDateString("es-ES")}</td>
              <td className="py-2 pr-3">{f.comercial || "—"}</td>
              <td className="py-2">{f.channel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-3 text-[13px]">
        <span>{total} valoraciones</span>
        {pagina > 1 ? <Link href={`/valoraciones?pagina=${pagina - 1}${canal ? `&canal=${canal}` : ""}`}>Anterior</Link> : null}
        <span>{pagina} / {paginas}</span>
        {pagina < paginas ? <Link href={`/valoraciones?pagina=${pagina + 1}${canal ? `&canal=${canal}` : ""}`}>Siguiente</Link> : null}
      </div>
    </div>
  );
}
