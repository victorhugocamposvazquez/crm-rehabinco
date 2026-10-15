"use client";

import { Selector } from "@/components/ui/selector";
import type { InmuebleFormValues } from "@/lib/inmuebles/catalogo";
import {
  IDEALISTA_TIPOS,
  IDEALISTA_TIPO_LABEL,
  IDEALISTA_VISIBILIDAD,
  IDEALISTA_VISIBILIDAD_AYUDA,
  IDEALISTA_VISIBILIDAD_LABEL,
  type IdealistaVisibilidadDireccion,
} from "@/lib/inmuebles/idealista";
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
  const control =
    controlClassName ??
    "flex h-10 w-full rounded-lg border border-border bg-[var(--surface)] px-4 text-base";

  return (
    <div className="space-y-3">
      <Check
        titulo="Publicar en la web"
        checked={values.publicar_web}
        onChange={(checked) => onChange({ publicar_web: checked })}
      />
      <Check titulo="Publicar en Idealista" checked={values.publicar_idealista} />

      <div className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-[13px] font-semibold text-[var(--text-1)]">Datos para Idealista</p>
        <label className="block text-[13px]">
          <span className="mb-1.5 block font-medium text-[var(--text-2)]">Tipo de vivienda / inmueble</span>
          <Selector
            value={values.idealista_tipo}
            onChange={(e) => onChange({ idealista_tipo: e.target.value })}
            className={control}
          >
            {IDEALISTA_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {IDEALISTA_TIPO_LABEL[tipo]}
              </option>
            ))}
          </Selector>
        </label>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 block text-[13px] font-medium text-[var(--text-2)]">Visibilidad en portales</legend>
          {IDEALISTA_VISIBILIDAD.map((opcion) => (
            <VisibilidadRadio
              key={opcion}
              value={opcion}
              checked={values.idealista_visibilidad_direccion === opcion}
              titulo={IDEALISTA_VISIBILIDAD_LABEL[opcion]}
              ayuda={IDEALISTA_VISIBILIDAD_AYUDA[opcion]}
              onSelect={() => onChange({ idealista_visibilidad_direccion: opcion })}
            />
          ))}
        </fieldset>
      </div>

      <label className="block text-[13px]">
        <span className="mb-1.5 block font-medium text-[var(--text-2)]">Certificado energético</span>
        <Selector
          value={values.certificado_energetico}
          onChange={(e) => onChange({ certificado_energetico: e.target.value })}
          className={control}
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

function VisibilidadRadio({
  value,
  checked,
  titulo,
  ayuda,
  onSelect,
}: {
  value: IdealistaVisibilidadDireccion;
  checked: boolean;
  titulo: string;
  ayuda: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${checked ? "border-[var(--accent)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}
    >
      <input
        type="radio"
        name="idealista_visibilidad_direccion"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span>
        <span className={`block text-[13.5px] font-medium ${checked ? "text-[var(--accent)]" : ""}`}>{titulo}</span>
        <span className="text-[12px] text-[var(--text-2)]">{ayuda}</span>
      </span>
    </label>
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
