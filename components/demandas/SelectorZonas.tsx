"use client";

import { BuscadorLocalidad } from "@/components/geo/BuscadorLocalidad";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { ALREDEDORES_A_CORUNA, DISTRITOS_A_CORUNA } from "@/lib/demandas/zonas-coruna";

export function SelectorZonas({
  value,
  onChange,
}: {
  value: string[];
  onChange: (zonas: string[]) => void;
}) {
  const toggle = (nombre: string) => {
    onChange(value.includes(nombre) ? value.filter((zona) => zona !== nombre) : [...value, nombre]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-[var(--text-2)]">Distritos de A Coruña</p>
        <div className="flex flex-wrap gap-2">
          {DISTRITOS_A_CORUNA.map((zona) => (
            <ToggleChip key={zona.nombre} on={value.includes(zona.nombre)} onClick={() => toggle(zona.nombre)}>
              {zona.nombre}
            </ToggleChip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-[var(--text-2)]">Área de A Coruña</p>
        <div className="flex flex-wrap gap-2">
          {ALREDEDORES_A_CORUNA.map((nombre) => (
            <ToggleChip key={nombre} on={value.includes(nombre)} onClick={() => toggle(nombre)}>
              {nombre}
            </ToggleChip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-[var(--text-2)]">Otra localidad de España</p>
        <BuscadorLocalidad
          multiple
          value={value}
          onChange={(valor) => onChange(Array.isArray(valor) ? valor : valor ? [valor] : [])}
          placeholder="Municipio · 3 letras"
        />
      </div>
    </div>
  );
}
