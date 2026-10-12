/** Extractos Geofabrik (España y CCAA). https://download.geofabrik.de/europe/spain.html */
export type GeofabrikSpec = { url: string; file: string; label: string };

const BASE = "https://download.geofabrik.de/europe/spain";

export const GEOFABRIK: Record<string, GeofabrikSpec> = {
  spain: {
    url: `${BASE}-latest.osm.pbf`,
    file: "spain-latest.osm.pbf",
    label: "España",
  },
  "spain/andalucia": { url: `${BASE}/andalucia-latest.osm.pbf`, file: "andalucia-latest.osm.pbf", label: "Andalucía" },
  "spain/aragon": { url: `${BASE}/aragon-latest.osm.pbf`, file: "aragon-latest.osm.pbf", label: "Aragón" },
  "spain/asturias": { url: `${BASE}/asturias-latest.osm.pbf`, file: "asturias-latest.osm.pbf", label: "Asturias" },
  "spain/balears": { url: `${BASE}/balears-latest.osm.pbf`, file: "balears-latest.osm.pbf", label: "Illes Balears" },
  "spain/canarias": { url: `${BASE}/canarias-latest.osm.pbf`, file: "canarias-latest.osm.pbf", label: "Canarias" },
  "spain/cantabria": { url: `${BASE}/cantabria-latest.osm.pbf`, file: "cantabria-latest.osm.pbf", label: "Cantabria" },
  "spain/castilla-la-mancha": {
    url: `${BASE}/castilla-la-mancha-latest.osm.pbf`,
    file: "castilla-la-mancha-latest.osm.pbf",
    label: "Castilla-La Mancha",
  },
  "spain/castilla-y-leon": {
    url: `${BASE}/castilla-y-leon-latest.osm.pbf`,
    file: "castilla-y-leon-latest.osm.pbf",
    label: "Castilla y León",
  },
  "spain/cataluna": { url: `${BASE}/cataluna-latest.osm.pbf`, file: "cataluna-latest.osm.pbf", label: "Cataluña" },
  "spain/ceuta": { url: `${BASE}/ceuta-latest.osm.pbf`, file: "ceuta-latest.osm.pbf", label: "Ceuta" },
  "spain/extremadura": { url: `${BASE}/extremadura-latest.osm.pbf`, file: "extremadura-latest.osm.pbf", label: "Extremadura" },
  "spain/galicia": { url: `${BASE}/galicia-latest.osm.pbf`, file: "galicia-latest.osm.pbf", label: "Galicia" },
  "spain/la-rioja": { url: `${BASE}/la-rioja-latest.osm.pbf`, file: "la-rioja-latest.osm.pbf", label: "La Rioja" },
  "spain/madrid": { url: `${BASE}/madrid-latest.osm.pbf`, file: "madrid-latest.osm.pbf", label: "Comunidad de Madrid" },
  "spain/melilla": { url: `${BASE}/melilla-latest.osm.pbf`, file: "melilla-latest.osm.pbf", label: "Melilla" },
  "spain/murcia": { url: `${BASE}/murcia-latest.osm.pbf`, file: "murcia-latest.osm.pbf", label: "Región de Murcia" },
  "spain/navarra": { url: `${BASE}/navarra-latest.osm.pbf`, file: "navarra-latest.osm.pbf", label: "Navarra" },
  "spain/pais-vasco": { url: `${BASE}/pais-vasco-latest.osm.pbf`, file: "pais-vasco-latest.osm.pbf", label: "País Vasco" },
  "spain/valencia": { url: `${BASE}/valencia-latest.osm.pbf`, file: "valencia-latest.osm.pbf", label: "Comunitat Valenciana" },
};

export function geofabrikScopeFromProvince(provinceCode: string): string {
  const p = provinceCode.padStart(2, "0").slice(-2);
  const galicia = new Set(["15", "27", "32", "36"]);
  const catalunya = new Set(["08", "17", "25", "43"]);
  const andalucia = new Set(["04", "11", "14", "18", "21", "23", "29", "41"]);
  const paisVasco = new Set(["01", "20", "48"]);
  if (galicia.has(p)) return "spain/galicia";
  if (catalunya.has(p)) return "spain/cataluna";
  if (p === "28") return "spain/madrid";
  if (andalucia.has(p)) return "spain/andalucia";
  if (paisVasco.has(p)) return "spain/pais-vasco";
  if (p === "46") return "spain/valencia";
  if (p === "31") return "spain/navarra";
  if (p === "33") return "spain/asturias";
  if (p === "39") return "spain/cantabria";
  if (p === "07") return "spain/balears";
  if (p === "35" || p === "38") return "spain/canarias";
  if (p === "51" || p === "52") return p === "51" ? "spain/ceuta" : "spain/melilla";
  if (["05", "09", "24", "34", "37", "40", "42", "47", "49"].includes(p)) return "spain/castilla-y-leon";
  if (["02", "13", "16", "19", "45"].includes(p)) return "spain/castilla-la-mancha";
  if (["06", "10"].includes(p)) return "spain/extremadura";
  if (p === "30") return "spain/murcia";
  if (["22", "44", "50"].includes(p)) return "spain/aragon";
  if (p === "26") return "spain/la-rioja";
  return "spain";
}

export function resolveGeofabrikScope(input: string | null | undefined): string {
  const raw = (input ?? "spain").trim().toLowerCase();
  if (GEOFABRIK[raw]) return raw;
  if (/^\d{2}$/.test(raw)) return geofabrikScopeFromProvince(raw);
  return "spain";
}
