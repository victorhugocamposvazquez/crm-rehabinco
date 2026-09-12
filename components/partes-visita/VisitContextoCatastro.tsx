import { BadgeCatastroExplorer } from "@/components/catastro/BadgeCatastroExplorer";
import type { ContextoCatastralVisita } from "@/lib/partes-visita";

export function VisitContextoCatastro({ contexto }: { contexto: ContextoCatastralVisita }) {
  if (!contexto) return null;
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Origen de propiedad
      </p>
      <div className="mt-1">
        <BadgeCatastroExplorer />
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Referencia catastral
      </p>
      <p className="mt-0.5 font-mono text-sm tracking-wide text-foreground">{contexto.fincaReference}</p>
    </div>
  );
}
