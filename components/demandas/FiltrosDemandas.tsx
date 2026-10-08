"use client";

import { Search } from "lucide-react";
import { Selector } from "@/components/ui/selector";
import { TIPO_INMUEBLE_LABEL, TIPOS_INMUEBLE, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { TIPOS_OPERACION_DEMANDA, TIPO_OPERACION_DEMANDA_LABEL } from "@/lib/demandas/matching";
import { hayFiltroListado, type FiltroListadoDemanda } from "@/lib/demandas/filtros";
import { cn } from "@/lib/utils";

export type OpcionComercialFiltro = { id: string; nombre: string };

const control = "h-11 w-full min-[820px]:h-9 min-[820px]:w-auto min-[820px]:min-w-[10.5rem]";

export function FiltrosDemandas({
  filtro,
  onChange,
  tipos,
  zonas,
  comerciales,
}: {
  filtro: FiltroListadoDemanda;
  onChange: (filtro: FiltroListadoDemanda) => void;
  tipos: string[];
  zonas: string[];
  comerciales: OpcionComercialFiltro[];
}) {
  const activo = hayFiltroListado(filtro);
  const set = (parcial: Partial<FiltroListadoDemanda>) => onChange({ ...filtro, ...parcial });
  const clase = (encendido: boolean) => cn(control, encendido && "border-accent bg-accent-soft");

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 min-[820px]:flex min-[820px]:flex-wrap min-[820px]:items-center">
      <label className="relative col-span-2 min-w-0 min-[820px]:min-w-[14rem] min-[820px]:flex-1">
        <span className="sr-only">Buscar por cliente, zona o comercial</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-2)]" strokeWidth={2} />
        <input
          type="search"
          value={filtro.q}
          onChange={(event) => set({ q: event.target.value })}
          placeholder="Cliente, zona o comercial"
          className="h-11 w-full rounded-[9px] border border-[var(--input)] bg-[var(--field)] pl-9 pr-3 text-[16px] text-foreground outline-none placeholder:text-[var(--text-3)] focus:border-accent min-[820px]:h-9 min-[820px]:text-[13.5px]"
        />
      </label>
      <div className="min-w-0 min-[820px]:contents">
        <Selector
          aria-label="Operación"
          value={filtro.operacion}
          onChange={(event) => set({ operacion: event.target.value })}
          className={clase(Boolean(filtro.operacion))}
        >
          <option value="">Operación</option>
          {TIPOS_OPERACION_DEMANDA.map((op) => (
            <option key={op} value={op}>
              {TIPO_OPERACION_DEMANDA_LABEL[op]}
            </option>
          ))}
        </Selector>
      </div>
      <div className="min-w-0 min-[820px]:contents">
        <Selector
          aria-label="Tipo de inmueble"
          value={filtro.tipo}
          onChange={(event) => set({ tipo: event.target.value })}
          className={clase(Boolean(filtro.tipo))}
        >
          <option value="">Tipo</option>
          {tipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {TIPO_INMUEBLE_LABEL[tipo as TipoInmueble] ?? tipo}
            </option>
          ))}
        </Selector>
      </div>
      <div className="min-w-0 min-[820px]:contents">
        <Selector
          aria-label="Zona"
          value={filtro.zona}
          onChange={(event) => set({ zona: event.target.value })}
          className={clase(Boolean(filtro.zona))}
        >
          <option value="">Zona</option>
          {zonas.map((zona) => (
            <option key={zona} value={zona}>
              {zona}
            </option>
          ))}
        </Selector>
      </div>
      <div className="min-w-0 min-[820px]:contents">
        <Selector
          aria-label="Comercial"
          value={filtro.comercialId}
          onChange={(event) => set({ comercialId: event.target.value })}
          className={clase(Boolean(filtro.comercialId))}
        >
          <option value="">Comercial</option>
          {comerciales.map((comercial) => (
            <option key={comercial.id} value={comercial.id}>
              {comercial.nombre}
            </option>
          ))}
        </Selector>
      </div>
      {activo ? (
        <button
          type="button"
          onClick={() => onChange({ q: "", operacion: "", tipo: "", zona: "", comercialId: "" })}
          className="col-span-2 h-11 rounded-[9px] text-[13.5px] font-semibold text-accent min-[820px]:h-9 min-[820px]:px-2"
        >
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}

export function tiposVisibles(presentes: string[], elegido: string): string[] {
  const set = new Set(presentes);
  if (elegido) set.add(elegido);
  const conocidos = TIPOS_INMUEBLE.filter((tipo) => set.has(tipo));
  const resto = [...set].filter((tipo) => !TIPOS_INMUEBLE.includes(tipo as TipoInmueble)).sort((a, b) => a.localeCompare(b, "es"));
  return [...conocidos, ...resto];
}
