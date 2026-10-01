"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import {
  ESTADOS_CIVILES,
  normalizarEstadoCivil,
  type PersonaArras,
  type TratamientoPersona,
} from "@/lib/contrato-arras";

export function PersonaArrasCard({
  titulo,
  persona,
  onChange,
  onRemove,
  puedeQuitar,
}: {
  titulo: string;
  persona: PersonaArras;
  onChange: (p: PersonaArras) => void;
  onRemove: () => void;
  puedeQuitar: boolean;
}) {
  const set = (patch: Partial<PersonaArras>) => onChange({ ...persona, ...patch });
  const estadoCivil = normalizarEstadoCivil(persona.estado_civil);
  return (
    <div className="rounded-[12px] border border-[var(--border-soft)] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{titulo}</p>
        {puedeQuitar ? (
          <button type="button" onClick={onRemove} className="text-[var(--text-2)] hover:text-red-600" aria-label="Quitar">
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 min-[820px]:grid-cols-2">
        <div className="min-[820px]:col-span-2">
          <div className="mb-2 flex flex-wrap gap-2">
            {(["Don", "Doña"] as TratamientoPersona[]).map((t) => (
              <ToggleChip key={t} on={persona.tratamiento === t} onClick={() => set({ tratamiento: t })}>
                {t}
              </ToggleChip>
            ))}
          </div>
          <Label>Nombre y apellidos</Label>
          <Input className="mt-1.5" value={persona.nombre} onChange={(e) => set({ nombre: e.target.value })} />
        </div>
        <div>
          <Label>Estado civil</Label>
          <select
            className="mt-1.5 flex h-9 w-full rounded-[9px] border border-[var(--input)] bg-white px-3 py-0 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:h-[46px] max-[819px]:text-base"
            value={estadoCivil}
            onChange={(e) => set({ estado_civil: e.target.value })}
          >
            <option value="">Seleccionar</option>
            {ESTADOS_CIVILES.map((e) => (
              <option key={e.value} value={e.value}>
                {persona.tratamiento === "Doña" ? e.labelDona : e.labelDon}
              </option>
            ))}
            {estadoCivil && !ESTADOS_CIVILES.some((e) => e.value === estadoCivil) ? (
              <option value={estadoCivil}>{persona.estado_civil}</option>
            ) : null}
          </select>
        </div>
        <div>
          <Label>DNI</Label>
          <Input className="mt-1.5" value={persona.dni} onChange={(e) => set({ dni: e.target.value })} />
        </div>
        <div>
          <Label>Vecino/a de</Label>
          <Input className="mt-1.5" value={persona.vecindad} onChange={(e) => set({ vecindad: e.target.value })} />
        </div>
        <div>
          <Label>Domicilio</Label>
          <Input
            className="mt-1.5"
            value={persona.domicilio}
            onChange={(e) => set({ domicilio: e.target.value })}
            placeholder="calle …"
          />
        </div>
      </div>
    </div>
  );
}
