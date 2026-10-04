import { completitudFicha, type CompletitudFicha } from "@/lib/inmuebles/completitud";

export function FichaCompletitudBarra({ ficha }: { ficha: CompletitudFicha }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ficha {ficha.porcentaje} % rellena</p>
        <p className="text-xs text-[var(--text-3)]">
          {ficha.rellenos}/{ficha.total}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--input)]">
        <div className="h-full rounded-full bg-[var(--green)]" style={{ width: `${ficha.porcentaje}%` }} />
      </div>
      {ficha.faltan.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--text-3)]">Falta: {ficha.faltan.join(", ")}.</p>
      ) : (
        <p className="mt-2 text-xs text-[var(--green)]">Lista para matching y para enseñar.</p>
      )}
    </div>
  );
}

export { completitudFicha };
