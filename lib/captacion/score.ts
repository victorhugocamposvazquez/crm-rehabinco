export type SenalScore = {
  senal: string;
  peso: number;
  detalle: string;
};

export type ContactoScoreInput = {
  anuncios: Array<{
    anunciante: string;
    nombre_comercial?: string | null;
    contacto_nombre?: string | null;
    contacto_telefono?: string | null;
    operacion: string;
    tipo: string | null;
    municipio: string | null;
    portal_id: string;
    descripcion?: string | null;
    publicado_en?: string | null;
    desaparecido_en?: string | null;
    created_at?: string | null;
  }>;
  pesos: Record<string, number>;
};

const JERGA = [
  "disponemos de",
  "oportunidad de inversión",
  "honorarios",
  "sin comisión",
  "ideal inversores",
  "consulte condiciones",
  "ref.",
  "referencia",
  "nuestra cartera",
  "visita virtual",
  "se aceptan ofertas",
];

const MARCAS = ["inmo", "home", "fincas", "properties", "gestión", "s.l.", "real estate", "oficina", "departamento"];

export function calcularScore(
  contacto: ContactoScoreInput,
  opts?: { descripcionesOtrosContactos?: string[]; phashCoincideOtroContacto?: boolean }
): { score: number; senales: SenalScore[]; nivel: "ninguno" | "amarillo" | "rojo" } {
  const { anuncios, pesos } = contacto;
  const activos = anuncios.filter((a) => !a.desaparecido_en);
  const senales: SenalScore[] = [];
  const p = (k: string, d: number) => pesos[k] ?? d;

  if (anuncios.some((a) => a.anunciante === "empresa" || a.anunciante === "profesional")) {
    senales.push({ senal: "portal_profesional", peso: p("portal_profesional", 60), detalle: "Marcado profesional en algún anuncio" });
  }

  const nombreComercial = anuncios.find((a) => a.nombre_comercial?.trim());
  if (nombreComercial && anuncios.some((a) => a.anunciante === "particular")) {
    senales.push({ senal: "nombre_comercial", peso: p("nombre_comercial", 40), detalle: "Nombre comercial en anuncio particular" });
  }

  const nombre = (anuncios[0]?.contacto_nombre ?? "").toLowerCase();
  if (MARCAS.some((m) => nombre.includes(m))) {
    senales.push({ senal: "nombre_marca", peso: p("nombre_marca", 35), detalle: "Nombre con términos de agencia" });
  }

  const tel = anuncios.find((a) => a.contacto_telefono)?.contacto_telefono ?? "";
  const digits = tel.replace(/\D/g, "");
  if (/^[89]/.test(digits.slice(-9))) {
    senales.push({ senal: "telefono_fijo", peso: p("telefono_fijo", 20), detalle: "Teléfono fijo (8xx/9xx)" });
  }

  if (activos.length >= 5) {
    senales.push({ senal: "muchos_anuncios_5", peso: p("muchos_anuncios_5", 40), detalle: `${activos.length} anuncios activos` });
  } else if (activos.length >= 3) {
    senales.push({ senal: "muchos_anuncios_3_4", peso: p("muchos_anuncios_3_4", 20), detalle: `${activos.length} anuncios activos` });
  }

  const municipios = new Set(anuncios.map((a) => a.municipio).filter(Boolean));
  if (municipios.size >= 2) {
    senales.push({ senal: "varios_municipios", peso: p("varios_municipios", 25), detalle: `${municipios.size} municipios` });
  }

  const ops = new Set(anuncios.map((a) => a.operacion));
  if (ops.has("venta") && ops.has("alquiler")) {
    senales.push({ senal: "venta_y_alquiler", peso: p("venta_y_alquiler", 20), detalle: "Venta y alquiler simultáneos" });
  }

  const tipos = new Set(anuncios.map((a) => a.tipo).filter(Boolean));
  if (tipos.size >= 3) {
    senales.push({ senal: "varios_tipos", peso: p("varios_tipos", 25), detalle: `${tipos.size} tipos de inmueble` });
  }

  const portales = new Set(anuncios.map((a) => a.portal_id));
  if (portales.size >= 3) {
    senales.push({ senal: "varios_portales", peso: p("varios_portales", 15), detalle: `${portales.size} portales` });
  }

  const textos = anuncios.map((a) => (a.descripcion ?? "").toLowerCase());
  const jergaCount = JERGA.filter((j) => textos.some((t) => t.includes(j))).length;
  if (jergaCount >= 2) {
    senales.push({ senal: "jerga_agencia", peso: p("jerga_agencia", 20), detalle: `${jergaCount} expresiones de agencia` });
  }

  if (textos.some((t) => /la vivienda se encuentra|el inmueble dispone/i.test(t) && !/mi casa|nuestra casa/i.test(t))) {
    senales.push({ senal: "tercera_persona", peso: p("tercera_persona", 10), detalle: "Descripción en tercera persona" });
  }

  const fechas = anuncios
    .map((a) => new Date(a.publicado_en ?? a.created_at ?? "").getTime())
    .filter((t) => !Number.isNaN(t));
  if (fechas.length >= 3) {
    const min = Math.min(...fechas);
    const max = Math.max(...fechas);
    if (max - min > 60 * 86400000) {
      senales.push({ senal: "cadencia_larga", peso: p("cadencia_larga", 25), detalle: "Anuncios repartidos >60 días" });
    }
  }

  const retirados90 = anuncios.filter((a) => a.desaparecido_en).length;
  const nuevos90 = activos.length;
  if (retirados90 >= 2 && nuevos90 >= 1) {
    senales.push({ senal: "rotacion", peso: p("rotacion", 20), detalle: "Rotación de anuncios" });
  }

  if (opts?.phashCoincideOtroContacto) {
    senales.push({ senal: "fotos_compartidas", peso: p("fotos_compartidas", 30), detalle: "Fotos compartidas con otro contacto" });
  }

  const score = Math.min(100, senales.reduce((s, x) => s + x.peso, 0));
  let nivel: "ninguno" | "amarillo" | "rojo" = "ninguno";
  if (score >= 70) nivel = "rojo";
  else if (score >= 40 || activos.length >= 3) nivel = "amarillo";

  // Herencia probable: 2-3 anuncios mismo tipo/municipio, score bajo
  if (
    activos.length <= 3 &&
    activos.length >= 2 &&
    tipos.size === 1 &&
    municipios.size === 1 &&
    score < 40
  ) {
    if (nivel === "rojo" && score < 50) nivel = "amarillo";
  }

  return { score, senales, nivel };
}
