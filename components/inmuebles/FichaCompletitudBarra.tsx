import { completitudFicha, type CompletitudFicha } from "@/lib/inmuebles/completitud";

export function FichaCompletitudBarra({ ficha }: { ficha: CompletitudFicha }) {
  return (
    <div className="rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ficha {ficha.porcentaje} % rellena</p>
        <p className="text-xs text-[#5D6B67]">
          {ficha.rellenos}/{ficha.total}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F2F0EB]">
        <div className="h-full rounded-full bg-[#0B7461]" style={{ width: `${ficha.porcentaje}%` }} />
      </div>
      {ficha.faltan.length > 0 ? (
        <p className="mt-2 text-xs text-[#5D6B67]">Falta: {ficha.faltan.join(", ")}.</p>
      ) : (
        <p className="mt-2 text-xs text-[#0B7461]">Lista para matching y para enseñar.</p>
      )}
    </div>
  );
}

export { completitudFicha };
