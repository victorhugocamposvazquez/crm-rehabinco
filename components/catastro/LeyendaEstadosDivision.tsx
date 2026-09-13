import {
  LEYENDA_ESTADOS_DIVISION,
  LEYENDA_FILTRO_TODAS,
  TITULO_LEYENDA_DIVISION,
  claseBadgeDivision,
} from "@/lib/catastro/search-ui";
import { cn } from "@/lib/utils";

export function LeyendaEstadosDivision() {
  return (
    <section
      aria-labelledby="leyenda-division-titulo"
      className="mt-4 rounded-2xl border border-border bg-neutral-50/80 px-4 py-3.5"
    >
      <h2 id="leyenda-division-titulo" className="text-sm font-semibold text-foreground">
        {TITULO_LEYENDA_DIVISION}
      </h2>
      <p className="mt-1 text-xs text-neutral-500">{LEYENDA_FILTRO_TODAS}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {LEYENDA_ESTADOS_DIVISION.map((item) => (
          <li key={item.status} className="min-w-0">
            <span
              className={cn(
                "inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
                claseBadgeDivision(item.status)
              )}
            >
              {item.etiqueta}
            </span>
            <p className="mt-1.5 text-[11px] font-medium text-neutral-600">{item.filtro}</p>
            <p className="mt-0.5 text-xs leading-snug text-neutral-600">{item.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
