import type { CSSProperties } from "react";

/** Pasa el color del comercial; el contraste lo resuelve `.cal-evento` / `.cal-chip-mes` en globals.css. */
export function varsEventoCalendario(color: string): CSSProperties {
  return { ["--ev-hue" as string]: color } as CSSProperties;
}
