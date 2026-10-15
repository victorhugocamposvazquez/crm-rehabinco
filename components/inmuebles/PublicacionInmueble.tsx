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
        checked={values.publicar_web}
        onChange={(checked) => onChange({ publicar_web: checked })}
      />
      <Check titulo="Publicar en Idealista" checked={values.publicar_idealista} />
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
  checked,
  onChange,
}: {
  titulo: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const pronto = !onChange;
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] px-4 py-3.5 ${pronto ? "cursor-not-allowed bg-[var(--surface-soft)] opacity-70" : "cursor-pointer bg-[var(--surface)]"}`}
    >
      <span>
        <span className="block text-[14px] font-semibold">{titulo}</span>
        <span className="text-[12.5px] text-[var(--text-2)]">{pronto ? "Muy pronto" : "Sale en la web pública si la ficha está completa."}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={pronto}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  );
}
