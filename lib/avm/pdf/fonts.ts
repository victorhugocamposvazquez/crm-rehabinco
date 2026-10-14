import { Font } from "@react-pdf/renderer";

let registradas = false;

/**
 * Helvetica y Courier van dentro del propio PDF. Los TTF de Inter no se
 * abren en el servidor y el generador revienta con unitsPerEm.
 */
export function registrarFuentesPdf(): void {
  if (registradas) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: "Helvetica", fontWeight: 400 },
      { src: "Helvetica", fontWeight: 500 },
      { src: "Helvetica-Bold", fontWeight: 600 },
      { src: "Helvetica-Bold", fontWeight: 700 },
    ],
  });
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: "Courier", fontWeight: 400 },
      { src: "Courier-Bold", fontWeight: 500 },
      { src: "Courier-Bold", fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registradas = true;
}
