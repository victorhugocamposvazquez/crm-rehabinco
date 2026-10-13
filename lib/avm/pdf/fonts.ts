import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registradas = false;

/** Inter (regular, medium, semibold, bold) y JetBrains Mono embebidas. */
export function registrarFuentesPdf(): void {
  if (registradas) return;
  const dir = path.join(process.cwd(), "lib/avm/pdf/fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: path.join(dir, "JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "JetBrainsMono-Medium.ttf"), fontWeight: 500 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registradas = true;
}
