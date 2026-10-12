/** Provincias INE (52) → nombre oficial en la Sede del Catastro (np). */
export const PROVINCIAS_CATASTRO: ReadonlyArray<{ code: string; name: string; foral: boolean }> = [
  { code: "01", name: "ARABA/ALAVA", foral: true },
  { code: "02", name: "ALBACETE", foral: false },
  { code: "03", name: "ALICANTE", foral: false },
  { code: "04", name: "ALMERIA", foral: false },
  { code: "05", name: "AVILA", foral: false },
  { code: "06", name: "BADAJOZ", foral: false },
  { code: "07", name: "BALEARS", foral: false },
  { code: "08", name: "BARCELONA", foral: false },
  { code: "09", name: "BURGOS", foral: false },
  { code: "10", name: "CACERES", foral: false },
  { code: "11", name: "CADIZ", foral: false },
  { code: "12", name: "CASTELLON", foral: false },
  { code: "13", name: "CIUDAD REAL", foral: false },
  { code: "14", name: "CORDOBA", foral: false },
  { code: "15", name: "A CORUÑA", foral: false },
  { code: "16", name: "CUENCA", foral: false },
  { code: "17", name: "GIRONA", foral: false },
  { code: "18", name: "GRANADA", foral: false },
  { code: "19", name: "GUADALAJARA", foral: false },
  { code: "20", name: "GIPUZKOA", foral: true },
  { code: "21", name: "HUELVA", foral: false },
  { code: "22", name: "HUESCA", foral: false },
  { code: "23", name: "JAEN", foral: false },
  { code: "24", name: "LEON", foral: false },
  { code: "25", name: "LLEIDA", foral: false },
  { code: "26", name: "LA RIOJA", foral: false },
  { code: "27", name: "LUGO", foral: false },
  { code: "28", name: "MADRID", foral: false },
  { code: "29", name: "MALAGA", foral: false },
  { code: "30", name: "MURCIA", foral: false },
  { code: "31", name: "NAVARRA", foral: true },
  { code: "32", name: "OURENSE", foral: false },
  { code: "33", name: "ASTURIAS", foral: false },
  { code: "34", name: "PALENCIA", foral: false },
  { code: "35", name: "LAS PALMAS", foral: false },
  { code: "36", name: "PONTEVEDRA", foral: false },
  { code: "37", name: "SALAMANCA", foral: false },
  { code: "38", name: "SANTA CRUZ DE TENERIFE", foral: false },
  { code: "39", name: "CANTABRIA", foral: false },
  { code: "40", name: "SEGOVIA", foral: false },
  { code: "41", name: "SEVILLA", foral: false },
  { code: "42", name: "SORIA", foral: false },
  { code: "43", name: "TARRAGONA", foral: false },
  { code: "44", name: "TERUEL", foral: false },
  { code: "45", name: "TOLEDO", foral: false },
  { code: "46", name: "VALENCIA", foral: false },
  { code: "47", name: "VALLADOLID", foral: false },
  { code: "48", name: "BIZKAIA", foral: true },
  { code: "49", name: "ZAMORA", foral: false },
  { code: "50", name: "ZARAGOZA", foral: false },
  { code: "51", name: "CEUTA", foral: false },
  { code: "52", name: "MELILLA", foral: false },
];

const BY_CODE = new Map(PROVINCIAS_CATASTRO.map((p) => [p.code, p]));

export function provinciaCatastroPorCodigo(code: string | null | undefined): string | null {
  const c = (code ?? "").replace(/\D/g, "").padStart(2, "0").slice(-2);
  if (c.length !== 2) return null;
  return BY_CODE.get(c)?.name ?? null;
}

export function esProvinciaForal(code: string): boolean {
  return BY_CODE.get(code.padStart(2, "0").slice(-2))?.foral ?? false;
}

export function ineProvinciaDeMunicipio(ineCode: string): string {
  return ineCode.replace(/\D/g, "").padStart(5, "0").slice(0, 2);
}
