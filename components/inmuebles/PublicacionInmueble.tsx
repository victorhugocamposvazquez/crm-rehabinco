"use client";

import { Selector } from "@/components/ui/selector";
import type { InmuebleFormValues } from "@/lib/inmuebles/catalogo";
import {
  CERTIFICADO_LABEL,
  CERTIFICADOS_ENERGETICOS,
  faltasIdealista,
  faltasWeb,
  type DatosPublicacion,
} from "@/lib/inmuebles/publicacion";

export function PublicacionInmueble({
  values,
  onChange,
  fotos,
  controlClassName,
}: {
  values: InmuebleFormValues;
  onChange: (patch: Partial<InmuebleFormValues>) => void;
  fotos: number;
  controlClassName?: string;
}) {
  const datos: DatosPublicacion = { ...values, fotos };
  const faltas = [
    ...(values.publicar_web ? faltasWeb(datos).map((f) => `Web · ${f}`) : []),
    ...(values.publicar_idealista ? faltasIdealista(datos).map((f) => `Idealista · ${f}`) : []),
  ];

  return (
    <div className="space-y-3">
      <Check
        titulo="Publicar en la web"
        detalle="Saldrá en la web de la agencia cuando la conectemos."
        checked={values.publicar_web}
        onChange={(publicar_web) => onChange({ publicar_web })}
      />
      <Check
        titulo="Publicar en Idealista"
        detalle="Queda marcado para el volcado. Aún no se envía solo."
        checked={values.publicar_idealista}
        onChange={(publicar_idealista) => onChange({ publicar_idealista })}
      />
      <label className="block text-[13px]">
        <span className="mb-1.5 block font-medium text-[var(--text-2)]">Certificado energético</span>
        <Selector
          value={values.certificado_energetico}
          onChange={(e) => onChange({ certificado_energetico: e.target.value })}
          className={controlClassName ?? "flex h-10 w-full rounded-lg border border-border bg-[var(--surface)] px-4 text-base"}
        >
          <option value="">Sin indicar</option>
          {CERTIFICADOS_ENERGETICOS.map((c) => (
            <option key={c} value={c}>
              {CERTIFICADO_LABEL[c]}
            </option>
          ))}
        </Selector>
      </label>
      {faltas.length ? (
        <ul className="space-y-1 text-[12.5px] text-red-600">
          {faltas.map((f) => (
            <li key={f}>Falta {f}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Check({
  titulo,
  detalle,
  checked,
  onChange,
}: {
  titulo: string;
  detalle: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
      <span>
        <span className="block text-[14px] font-semibold">{titulo}</span>
        <span className="text-[12.5px] text-[var(--text-2)]">{detalle}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  );
}
