"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { createClient } from "@/lib/supabase/client";
import { enviarValoracionAPapelera } from "@/lib/actions/avm-papelera";
import { ETIQUETA_CANAL, ETIQUETA_MAIN_TYPE, claseConfianza, etiquetaConfianzaCorta } from "@/lib/avm/ui/labels";
import { fmtEuros, fmtFechaCorta } from "@/lib/avm/ui/format";
import type { Channel, MainType } from "@/lib/avm/types";

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
  const [recarga, setRecarga] = useState(0);
  const [borrar, setBorrar] = useState<Fila | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const desde = (pagina - 1) * PAGE;
    let q = supabase
      .from("avm_valuations")
      .select("id, created_at, confidence, value_mid, channel, created_by, avm_properties(formatted_address, main_type, built_surface)", { count: "exact" })
      .is("deleted_at", null)
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
  }, [pagina, canal, recarga]);

  const enviarPapelera = async () => {
    if (!borrar) return;
    setEnviando(true);
    const result = await enviarValoracionAPapelera(borrar.id);
    setEnviando(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Enviada a la papelera.");
    setBorrar(null);
    setRecarga((n) => n + 1);
    window.dispatchEvent(new Event("avm-papelera"));
  };

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
            <th className="py-2 pr-3 font-medium">Canal</th>
            <th className="py-2 font-medium"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-[var(--border)]">
              <td className="py-2 pr-3"><Link href={`/valoraciones/${f.id}`} className="underline-offset-2 hover:underline">{f.property?.formatted_address || "Sin dirección"}</Link></td>
              <td className="py-2 pr-3">
                {f.property?.main_type && ETIQUETA_MAIN_TYPE[f.property.main_type as MainType]
                  ? ETIQUETA_MAIN_TYPE[f.property.main_type as MainType]
                  : f.property?.main_type || "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums">{f.property?.built_surface ?? "—"}</td>
              <td className="py-2 pr-3 tabular-nums">{fmtEuros(Number(f.value_mid))}</td>
              <td className="py-2 pr-3">
                <ConfianzaChip valor={f.confidence} />
              </td>
              <td className="py-2 pr-3">{fmtFechaCorta(f.created_at)}</td>
              <td className="py-2 pr-3">{f.comercial || "—"}</td>
              <td className="py-2 pr-3">{ETIQUETA_CANAL[f.channel as Channel] ?? f.channel}</td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-3)] hover:bg-red-500/10 hover:text-red-600"
                  aria-label={`Enviar a la papelera ${f.property?.formatted_address || ""}`}
                  onClick={() => setBorrar(f)}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </td>
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
      <AlertDialog
        open={borrar != null}
        onOpenChange={(open) => {
          if (!open) setBorrar(null);
        }}
        title="Enviar a la papelera"
        description={borrar?.property?.formatted_address || "Esta valoración dejará de verse en el listado. Puedes restaurarla desde la papelera."}
        confirmLabel="Enviar a la papelera"
        variant="destructive"
        loading={enviando}
        onConfirm={enviarPapelera}
      />
    </div>
  );
}

function ConfianzaChip({ valor }: { valor: number }) {
  const banda = claseConfianza(valor);
  const cls =
    banda === "good"
      ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : banda === "warn"
        ? "border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-400"
        : "border-transparent bg-red-500/10 text-red-700 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] tabular-nums ${cls}`}>
      {valor} % · {etiquetaConfianzaCorta(valor)}
    </span>
  );
}
