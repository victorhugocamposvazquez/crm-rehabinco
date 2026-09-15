import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  altaCamposVacios,
  borrarAltaBorrador,
  claveAltaBorrador,
  conMemoriaAltaBorrador,
  escribirAltaBorrador,
  hayAltaBorrador,
  hayTexto,
  horaAltaBorrador,
  leerAltaBorrador,
} from "./alta-borrador";

function memoriaMapa() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("alta borrador", () => {
  it("aísla cada tipo y ámbito", () => {
    assert.equal(claveAltaBorrador("inmueble"), "crm.alta.inmueble.libre");
    assert.equal(claveAltaBorrador("cliente", "padre-1"), "crm.alta.cliente.padre-1");
  });

  it("guarda, lee y se puede eliminar", () => {
    conMemoriaAltaBorrador(memoriaMapa());
    assert.equal(hayAltaBorrador("demanda"), false);
    const savedAt = escribirAltaBorrador("demanda", "libre", { zonas: ["Oleiros"] });
    assert.equal(hayAltaBorrador("demanda"), true);
    assert.equal(leerAltaBorrador<{ zonas: string[] }>("demanda")?.data.zonas[0], "Oleiros");
    assert.equal(horaAltaBorrador(savedAt)?.includes(":"), true);
    borrarAltaBorrador("demanda");
    assert.equal(hayAltaBorrador("demanda"), false);
    conMemoriaAltaBorrador(null);
  });

  it("un formulario vacío no cuenta como progreso", () => {
    assert.equal(altaCamposVacios("", "  ", [], false, null), true);
    assert.equal(hayTexto("Oleiros"), true);
    assert.equal(altaCamposVacios("piso"), false);
  });
});
