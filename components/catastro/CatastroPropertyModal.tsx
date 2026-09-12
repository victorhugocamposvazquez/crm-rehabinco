"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { crearGoogleMapsUrl } from "@/lib/catastro/explorer/maps";
import { prepararActualizacionCatastralUi, rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import {
  TEXTO_FUENTE_CATASTRO,
  fechasCatastroYProperty,
  frescuraInformacionCatastral,
} from "@/lib/catastro/explorer";
import {
  etiquetaEstadoDivision,
  textoMotivoUnknownUi,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";

function Dato({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function fechaActualizacion(iso?: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleString("es-ES");
}

export function CatastroPropertyModal({
  open,
  onClose,
  finca,
  lastSeenAt,
  propertyCreatedAt,
}: {
  open: boolean;
  onClose: () => void;
  finca: FincaBusquedaUi;
  lastSeenAt?: string | null;
  propertyCreatedAt?: string | null;
}) {
  const [consultando, setConsultando] = useState(false);
  const [frescura, setFrescura] = useState(() =>
    frescuraInformacionCatastral(lastSeenAt, new Date().toISOString())
  );
  if (!open) return null;

  const mapsUrl = crearGoogleMapsUrl(finca);
  const fechas = fechasCatastroYProperty({ lastSeenAt: frescura.lastSeenAt, propertyCreatedAt });
  const actualizacion = fechaActualizacion(fechas.ultimaInformacionCatastro);
  const creacionProperty = fechaActualizacion(fechas.fechaCreacionProperty);

  const actualizar = async () => {
    setConsultando(true);
    try {
      const resultado = await prepararActualizacionCatastralUi(finca.fincaReference);
      setFrescura(
        frescuraInformacionCatastral(resultado.lastSeenAt, new Date().toISOString())
      );
      toast.message(
        resultado.reciente
          ? "Información catastral localizada. Sigue siendo reciente. La consulta a Catastro no se ha ejecutado."
          : "Información catastral localizada. No es reciente. La consulta a Catastro se activará en una fase posterior."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido localizar la finca.");
    } finally {
      setConsultando(false);
    }
  };
  const motivo = textoMotivoUnknownUi(finca.horizontalDivision);
  const portales = finca.portals.filter(Boolean);
  const inmuebles = finca.properties ?? [];
  const address = finca.address;
  const cps = [...new Set([...(finca.postalCodes ?? []), finca.postalCode].filter(Boolean))] as string[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="catastro-property-modal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Fuente</p>
            <p id="catastro-property-modal-title" className="mt-0.5 text-sm font-semibold text-foreground">
              {TEXTO_FUENTE_CATASTRO}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Última información conocida de Catastro
              <span className="ml-1.5 text-foreground">{actualizacion ?? "—"}</span>
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-700">{frescura.etiqueta}</p>
            {creacionProperty ? (
              <p className="mt-2 text-xs text-neutral-500">
                Fecha de creación de Property
                <span className="ml-1.5 text-foreground">{creacionProperty}</span>
              </p>
            ) : null}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <section className="mt-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Identificación</h3>
            <dl className="mt-2 grid grid-cols-1 gap-3">
              <Dato label="Referencia catastral de finca" value={finca.fincaReference} />
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Dirección oficial</h3>
            <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Dato label="Sigla" value={address.sigla} />
              <Dato label="Vía" value={address.via} />
              <Dato label="Número" value={address.numero} />
              <Dato label="Número secundario" value={address.numero2} />
              <Dato label="Literal" value={address.literal} />
              <Dato label="Municipio" value={address.municipio} />
              <Dato label="Provincia" value={address.provincia} />
              <Dato label="Códigos postales" value={cps.join(", ")} />
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">División horizontal</h3>
            <p className="mt-2 text-sm font-medium text-foreground">
              {etiquetaEstadoDivision(finca.horizontalDivision?.status)}
            </p>
            {motivo ? <p className="mt-1 text-sm text-neutral-600">{motivo}</p> : null}
          </div>

          {finca.superficieSolar != null ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Solar</h3>
              <dl className="mt-2">
                <Dato label="Superficie solar" value={`${finca.superficieSolar} m²`} />
              </dl>
            </div>
          ) : null}

          {portales.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Portales</h3>
              <p className="mt-2 text-sm text-foreground">{portales.join(", ")}</p>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Inmuebles
              {inmuebles.length > 0 ? (
                <span className="ml-1.5 font-normal text-neutral-500">({inmuebles.length})</span>
              ) : null}
            </h3>
            {inmuebles.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                Catastro no ha devuelto inmuebles individuales para esta finca.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {inmuebles.map((inmueble) => (
                  <li key={inmueble.reference} className="rounded-xl border border-border px-3 py-3">
                    <p className="font-mono text-xs tracking-wide text-neutral-700">{inmueble.reference}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Dato label="Superficie" value={inmueble.superficie != null ? `${inmueble.superficie} m²` : null} />
                      <Dato label="Año" value={inmueble.anio} />
                      <Dato label="Uso" value={inmueble.uso} />
                      <Dato label="Bloque" value={inmueble.bloque} />
                      <Dato label="Escalera" value={inmueble.escalera} />
                      <Dato label="Planta" value={inmueble.planta} />
                      <Dato label="Puerta" value={inmueble.puerta} />
                      <Dato label="CP" value={inmueble.postalCode} />
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
          {mapsUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Ver en Google Maps
              </a>
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="sm">
            <a href={rutaFincaPersistida(finca.fincaReference)}>
              Abrir en Catastro Explorer
            </a>
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void actualizar()} disabled={consultando}>
            {consultando ? "Localizando…" : "Actualizar información catastral"}
          </Button>
        </div>
      </div>
    </div>
  );
}
