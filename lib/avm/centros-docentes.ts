/**
 * Centros docentes que puntúan en el entorno.
 * CEIP, CEP, CPI, CEE, IES, CIFP, CRA y colegios privados o concertados
 * de infantil (2.º ciclo), primaria, ESO y bachillerato → `school`.
 * Escuelas infantiles de 1.º ciclo (EEI) → `nursery`.
 * Academias, autoescuelas, enseñanzas no regladas y ludotecas quedan fuera.
 */
const ESCUELA = new Set(["CEIP", "CEP", "CPI", "CEE", "IES", "CIFP", "CRA", "CEEPR"]);
const INFANTIL = new Set(["EEI"]);

const NO_REGLADA =
  /academia|autoescuela|ludoteca|no reglada|formaci[oó]n|ilerna|premir|inf[oó]rmate|cesforem|ch[ií]os|apetamcor|fundaci[oó]n laboral|administraci[oó]n e finanzas|educaci[oó]n sanitaria|n[aá]utico|especialidades|estaci[oó]n naval|conservatorio|m[uú]sica|idiomas/i;

export type ClaseCentro = "school" | "nursery";

export function clasificarCentroDocente(tipo: string, nombre: string): ClaseCentro | null {
  const t = tipo.trim().toUpperCase();
  if (INFANTIL.has(t)) return "nursery";
  if (ESCUELA.has(t)) return "school";
  if (t === "CPR" || t === "CPREX") {
    if (NO_REGLADA.test(nombre)) return null;
    return "school";
  }
  return null;
}
