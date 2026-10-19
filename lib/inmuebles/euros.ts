/** Lee un precio escrito a la española: 350.000, 350.000 €, 1.200,50. */
export function eurosDesdeTexto(valor: string | null | undefined): number | null {
  if (!valor) return null;
  let s = valor
    .trim()
    .replace(/€/g, "")
    .replace(/\/\s*mes/gi, "")
    .replace(/\s/g, "");
  if (!s) return null;

  const tienePunto = s.includes(".");
  const tieneComa = s.includes(",");
  if (tienePunto && tieneComa) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (tieneComa) {
    const decimales = s.split(",")[1] ?? "";
    s = decimales.length === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
