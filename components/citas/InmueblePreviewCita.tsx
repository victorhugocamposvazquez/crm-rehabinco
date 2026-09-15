"use client";

import { MapPin } from "lucide-react";
import { FichaLink } from "@/components/crm/FichaPeek";
import { formatEuro } from "@/lib/ui/estados-vista";
import {
  direccionDeInmueble,
  enlaceGoogleMaps,
  type InmuebleCalendario,
} from "@/lib/citas/citas";

export function EnlaceMaps({
  consulta,
  lat,
  lng,
  compact = false,
}: {
  consulta?: string | null;
  lat?: number | null;
  lng?: number | null;
  compact?: boolean;
}) {
  const href = enlaceGoogleMaps({ consulta, lat, lng });
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {compact ? "Maps" : "Abrir en Google Maps"}
    </a>
  );
}

export function InmueblePreviewCita({ inmueble }: { inmueble: InmuebleCalendario }) {
  const direccion = direccionDeInmueble(inmueble);
  const precio =
    inmueble.tipo_operacion === "alquiler"
      ? inmueble.precio_alquiler != null
        ? `${formatEuro(inmueble.precio_alquiler)}/mes`
        : null
      : inmueble.precio_venta != null
        ? formatEuro(inmueble.precio_venta)
        : inmueble.precio_alquiler != null
          ? `${formatEuro(inmueble.precio_alquiler)}/mes`
          : null;
  const meta = [
    inmueble.habitaciones != null ? `${inmueble.habitaciones} hab.` : null,
    inmueble.superficie_m2 != null ? `${inmueble.superficie_m2} m²` : null,
    precio,
  ].filter(Boolean);

  return (
    <div className="mt-3 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)]">
      <div className="flex gap-3 p-3">
        {inmueble.portadaUrl ? (
          <img src={inmueble.portadaUrl} alt="" className="h-[4.5rem] w-[5.5rem] shrink-0 rounded-[8px] object-cover" />
        ) : (
          <div className="grid h-[4.5rem] w-[5.5rem] shrink-0 place-items-center rounded-[8px] bg-white text-[11px] font-medium text-[var(--text-3)]">
            Sin foto
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">
            {inmueble.referencia ? <span className="mr-1.5 text-[var(--text-3)]">{inmueble.referencia}</span> : null}
            {inmueble.titulo || inmueble.direccion || "Inmueble"}
          </p>
          {direccion ? <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-2)]">{direccion}</p> : null}
          {meta.length > 0 ? <p className="mt-1 text-[12px] font-medium text-[var(--text-2)]">{meta.join(" · ")}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
            <FichaLink tipo="propiedad" id={inmueble.id}>
              Ver ficha
            </FichaLink>
            <EnlaceMaps consulta={direccion} lat={inmueble.lat} lng={inmueble.lng} />
          </div>
        </div>
      </div>
    </div>
  );
}
