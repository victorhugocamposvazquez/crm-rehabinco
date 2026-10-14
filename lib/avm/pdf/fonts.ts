import { readFileSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registradas = false;

/** Data URL: en Vercel la ruta del archivo no llega al generador y la fuente queda vacía. */
function ttf(nombre: string): string {
  const bytes = readFileSync(path.join(process.cwd(), "lib/avm/pdf/fonts", nombre));
  return `data:font/ttf;base64,${bytes.toString("base64")}`;
}

/** Inter (regular, medium, semibold, bold) y JetBrains Mono embebidas. */
export function registrarFuentesPdf(): void {
  if (registradas) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: ttf("Inter-Regular.ttf"), fontWeight: 400 },
      { src: ttf("Inter-Medium.ttf"), fontWeight: 500 },
      { src: ttf("Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: ttf("Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: ttf("JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: ttf("JetBrainsMono-Medium.ttf"), fontWeight: 500 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registradas = true;
}
