import { describe, expect, it } from "vitest";
import { portalOpcional, visibleAlCliente, comparablesParaCalculo } from "../testigos-cliente";

describe("testigos que ve el propietario", () => {
  it("Idealista y Fotocasa quedan fuera si no se piden", () => {
    expect(portalOpcional("Idealista")).toBe(true);
    expect(portalOpcional("fotocasa")).toBe(true);
    expect(visibleAlCliente({ portal: "idealista" }, false)).toBe(false);
    expect(visibleAlCliente({ portal: "fotocasa" }, false)).toBe(false);
  });

  it("el resto de portales sigue saliendo", () => {
    expect(visibleAlCliente({ portal: "habitaclia" }, false)).toBe(true);
    expect(visibleAlCliente({ portal: "pisos" }, false)).toBe(true);
    expect(visibleAlCliente({ portal: "" }, false)).toBe(true);
  });

  it("con la opción marcada salen también Idealista y Fotocasa", () => {
    expect(visibleAlCliente({ portal: "idealista" }, true)).toBe(true);
    expect(visibleAlCliente({ portal: "fotocasa" }, true)).toBe(true);
  });

  it("el cálculo deja fuera Idealista y Fotocasa si no se piden", () => {
    const lista = [{ portal: "idealista" }, { portal: "fotocasa" }, { portal: "habitaclia" }];
    expect(comparablesParaCalculo(lista, false)).toEqual([{ portal: "habitaclia" }]);
    expect(comparablesParaCalculo(lista, true)).toEqual(lista);
    expect(portalOpcional("pisos")).toBe(false);
  });
});
