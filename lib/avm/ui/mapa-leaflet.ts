/** Marcador blanco con borde, sin PNG de Leaflet (compatible con Next). */
export function htmlMarcadorSujeto(): string {
  return '<div style="width:14px;height:14px;border-radius:50%;background:#f3f3f1;border:2px solid rgba(243,243,241,.35);box-shadow:0 0 0 2px #0a0a0b"></div>';
}

export const TILES_CARTO_OSCURO = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution: "&copy; OpenStreetMap &copy; CARTO",
  subdomains: "abcd" as const,
};
