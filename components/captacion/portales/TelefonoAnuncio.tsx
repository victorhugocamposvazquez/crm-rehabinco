"use client";

import { fechaCorta } from "@/lib/captacion/portales/modelo";
import { resolverEstadoTelefono, type TelefonoAnuncioCampos, type TelefonoEstado } from "@/lib/captacion/telefono-estado";
import { cn } from "@/lib/utils";

const ICONO: Record<TelefonoEstado, { glyph: string; title: string; className: string }> = {
  pendiente: { glyph: "⏳", title: "Teléfono pendiente", className: "text-[var(--text-2)]" },
  solo_mensaje: { glyph: "✉", title: "Solo contacto por mensaje", className: "text-[#7A5A10]" },
  virtual: { glyph: "↪", title: "Teléfono virtual de Idealista", className: "text-[#3A6A82]" },
  real: { glyph: "☎", title: "Teléfono real", className: "text-accent" },
  fallo: { glyph: "!", title: "No se pudo obtener el teléfono", className: "text-[#8A3030]" },
  no_solicitado: { glyph: "—", title: "Agencia: teléfono no solicitado", className: "text-[var(--text-2)]" },
};

type Props = {
  anuncio: TelefonoAnuncioCampos & { id: string; url: string | null; externo_id: string };
  enCola?: boolean;
  comercialNombre?: (id: string | null) => string | undefined;
  portalLabel?: string;
  compacto?: boolean;
  onAnadirTelefono?: (id: string) => void;
  onReintentar?: (id: string) => void;
  onPedirTelefono?: (id: string) => void;
};

export function IconoEstadoTelefono({ anuncio, enCola }: { anuncio: TelefonoAnuncioCampos; enCola?: boolean }) {
  const e = resolverEstadoTelefono(anuncio, enCola);
  const meta = ICONO[e];
  return (
    <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F4F3EF] text-[11px] font-bold", meta.className)} title={meta.title}>
      {meta.glyph}
    </span>
  );
}

export function TelefonoAnuncio({
  anuncio,
  enCola,
  comercialNombre,
  portalLabel,
  compacto,
  onAnadirTelefono,
  onReintentar,
  onPedirTelefono,
}: Props) {
  const estado = resolverEstadoTelefono(anuncio, enCola);
  const fmt = (iso: string | null | undefined) => (iso ? fechaCorta(new Date(iso)) : "—");

  if (compacto) {
    const tel = anuncio.contacto_telefono;
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <IconoEstadoTelefono anuncio={anuncio} enCola={enCola} />
        {tel && estado !== "pendiente" && estado !== "fallo" ? <span className="truncate font-mono text-[12px]">{tel}</span> : null}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <IconoEstadoTelefono anuncio={anuncio} enCola={enCola} />
        <div className="min-w-0 text-[13px]">
          {estado === "pendiente" ? (
            <p className="text-[var(--text-2)]">
              {enCola
                ? "En cola Unlocker · hasta 30 teléfonos por ráfaga (después de listados y fichas)"
                : anuncio.ficha_pendiente || !anuncio.contacto_telefono
                  ? "Espera ficha en cola · luego entra la petición de teléfono (particulares)"
                  : "Pendiente de desbloqueo · se encola al procesar la ficha o con «Pedir teléfono»"}
            </p>
          ) : null}
          {estado === "solo_mensaje" ? (
            <p className="text-[var(--text-2)]">Solo contacto por mensaje en Idealista</p>
          ) : null}
          {estado === "virtual" && anuncio.contacto_telefono ? (
            <p>
              <span className="font-mono">{anuncio.contacto_telefono}</span>
              <span className="text-[var(--text-2)]"> · virtual de Idealista, redirige al anunciante</span>
            </p>
          ) : null}
          {estado === "real" && anuncio.contacto_telefono ? (
            <p>
              <span className="font-mono">{anuncio.contacto_telefono}</span>
              <span className="text-[var(--text-2)]">
                {anuncio.telefono_capturado_en
                  ? ` · capturado por ${comercialNombre?.(anuncio.telefono_capturado_por ?? null) ?? "el equipo"} el ${fmt(anuncio.telefono_capturado_en)}`
                  : portalLabel
                    ? ` · de ${portalLabel}`
                    : anuncio.contacto_telefono_fuente === "unlocker"
                      ? " · de Idealista"
                      : ""}
              </span>
            </p>
          ) : null}
          {estado === "fallo" ? (
            <p className="text-[var(--text-2)]">No se pudo obtener; se reintenta el {fmt(anuncio.telefono_reintentar_en)}</p>
          ) : null}
          {estado === "no_solicitado" ? <p className="text-[var(--text-2)]">Agencia: no solicitado</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {estado === "solo_mensaje" && anuncio.url ? (
          <a href={anuncio.url} target="_blank" rel="noopener noreferrer" className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12px] font-semibold no-underline">
            Escribir en Idealista
          </a>
        ) : null}
        {(estado === "solo_mensaje" || estado === "virtual") && onAnadirTelefono ? (
          <button type="button" onClick={() => onAnadirTelefono(anuncio.id)} className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12px] font-semibold">
            Añadir teléfono
          </button>
        ) : null}
        {estado === "fallo" && onReintentar ? (
          <button type="button" onClick={() => onReintentar(anuncio.id)} className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12px] font-semibold">
            Reintentar ahora
          </button>
        ) : null}
        {estado === "no_solicitado" && onPedirTelefono ? (
          <button type="button" onClick={() => onPedirTelefono(anuncio.id)} className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12px] font-semibold">
            Pedir teléfono
          </button>
        ) : null}
      </div>
    </div>
  );
}
