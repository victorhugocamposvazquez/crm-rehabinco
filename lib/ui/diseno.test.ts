import { describe, expect, it } from "vitest";
import { parseDiseno, SCRIPT_DISENO, CLAVE_DISENO } from "./diseno-config";
import { DESCRIPCION_MODULO } from "../../components/layout/lanzador";
import { NAV_ITEMS } from "../../components/layout/nav-items";

describe("diseño Aire", () => {
  it("solo acepta 'aire'; cualquier otra cosa es el clásico", () => {
    expect(parseDiseno("aire")).toBe("aire");
    expect(parseDiseno("clasico")).toBe("clasico");
    expect(parseDiseno(undefined)).toBe("clasico");
    expect(parseDiseno("AIRE")).toBe("clasico");
  });

  it("el script del head lee la misma clave que guarda el selector", () => {
    expect(SCRIPT_DISENO).toContain(`localStorage.getItem("${CLAVE_DISENO}")`);
    expect(SCRIPT_DISENO).toContain('dataset.diseno="aire"');
  });

  it("cada módulo del menú tiene frase en el lanzador", () => {
    const sinFrase = NAV_ITEMS.filter((item) => !DESCRIPCION_MODULO[item.href]).map((item) => item.href);
    expect(sinFrase).toEqual([]);
  });
});
