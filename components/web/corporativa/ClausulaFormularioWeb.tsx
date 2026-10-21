"use client";

import Link from "next/link";
import { hrefPoliticaPrivacidad } from "@/lib/web/dominio";

export function ClausulaFormularioWeb({
  enDominio,
  aceptada,
  onChange,
  clara = false,
}: {
  enDominio: boolean;
  aceptada: boolean;
  onChange: (aceptada: boolean) => void;
  clara?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2.5 text-[13px] leading-relaxed ${clara ? "text-[#3a3a3a]" : "text-[rgba(254,254,254,.82)]"}`}>
      <input
        type="checkbox"
        required
        checked={aceptada}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#080808]"
      />
      <span>
        He leído la{" "}
        <Link href={hrefPoliticaPrivacidad(enDominio)} className="underline underline-offset-2">
          política de privacidad
        </Link>
        . Rehabinco usará estos datos para responder a esta consulta y, si procede, preparar una visita, un encargo inmobiliario o un presupuesto de reforma. Base: tu solicitud. No se ceden para publicidad de terceros.
      </span>
    </label>
  );
}
