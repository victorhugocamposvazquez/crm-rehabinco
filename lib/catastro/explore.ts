import { createCatastroClient } from "./client";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const client = createCatastroClient();
  const refCat = arg("refcat");

  const resultado = refCat
    ? await client.consultarReferencia({
        refCat,
        provincia: arg("provincia"),
        municipio: arg("municipio"),
      })
    : await client.consultarDireccion({
        provincia: arg("provincia") ?? "",
        municipio: arg("municipio") ?? "",
        sigla: arg("sigla"),
        calle: arg("calle") ?? "",
        numero: arg("numero") ?? "",
        bloque: arg("bloque"),
        escalera: arg("escalera"),
        planta: arg("planta"),
        puerta: arg("puerta"),
      });

  process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
}

main().catch((error) => {
  console.error("[catastro:explore]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
