"use client";

export type ComercialFiltro = { id: string; nombre: string; color: string | null };

export function FiltroComercial({
  comerciales,
  valor,
  onChange,
}: {
  comerciales: ComercialFiltro[];
  valor: string;
  onChange: (id: string) => void;
}) {
  if (comerciales.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          valor === "" ? "border-[#0B7461] bg-[#E8F3EF]" : "border-[#E6E3DD] bg-white"
        }`}
      >
        Equipo
      </button>
      {comerciales.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            valor === item.id ? "border-[#0B7461] bg-[#E8F3EF]" : "border-[#E6E3DD] bg-white"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color || "#3A6A82" }} />
          {item.nombre}
        </button>
      ))}
    </div>
  );
}
