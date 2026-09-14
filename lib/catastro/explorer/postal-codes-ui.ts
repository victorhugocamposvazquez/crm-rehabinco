/**
 * Textos y fetch del listado de CP por municipio. El navegador no carga el JSON completo.
 */
export type MunicipioPostalUi = {
  provinceCode: string;
  name: string;
  codes: string[];
};

export type RespuestaCodigosPostales = {
  ok: true;
  municipality: MunicipioPostalUi | null;
  owners: MunicipioPostalUi[];
};

export function nombreMunicipioVisible(nombre: string): string {
  const articulo = nombre.match(/^(.+),\s+(El|La|Los|Las|A|O|Os|As)$/i);
  if (articulo) return `${articulo[2]} ${articulo[1]}`;
  return nombre;
}

export function textoAyudaCodigosMunicipio(municipio: string, codes: string[]): string {
  const nombre = nombreMunicipioVisible(municipio);
  if (codes.length === 1) return `En ${nombre} el código postal es ${codes[0]}.`;
  return `Elige un código postal de ${nombre}.`;
}

export function avisoCodigoPostalAjeno(input: {
  postalCode: string;
  municipality: string;
  codes: string[];
  owners: Array<{ name: string }>;
}): string | null {
  const cp = input.postalCode.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(cp)) return null;
  if (input.codes.includes(cp)) return null;
  const dueños = input.owners.map((item) => nombreMunicipioVisible(item.name));
  const deOtro = dueños.length > 0 ? ` Ese código es de ${dueños.join(", ")}.` : "";
  return `${cp} no es de ${nombreMunicipioVisible(input.municipality)}.${deOtro}`;
}

export async function fetchCodigosPostalesMunicipio(
  input: { provinceCode: string; municipality: string; postalCode?: string },
  signal?: AbortSignal
): Promise<RespuestaCodigosPostales> {
  const params = new URLSearchParams({
    province: input.provinceCode,
    municipality: input.municipality,
  });
  if (input.postalCode?.trim()) params.set("postalCode", input.postalCode.trim());
  const respuesta = await fetch(`/api/catastro/postal-codes?${params}`, {
    credentials: "same-origin",
    signal,
    cache: "no-store",
  });
  const data = (await respuesta.json().catch(() => null)) as RespuestaCodigosPostales | null;
  if (!respuesta.ok || !data || data.ok !== true) {
    throw new Error("No se han podido cargar los códigos postales.");
  }
  return data;
}
