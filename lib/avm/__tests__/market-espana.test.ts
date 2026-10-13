import { describe, expect, it } from "vitest";
import { candidatosFotocasaDeNombre } from "../crawl/portal-slugs";
import { nombreDesdeDireccion } from "../market-espana";
import { portalTieneSlug, slugsSiFaltan } from "../market/portal-urls";

describe("mercado en cualquier municipio", () => {
  it("prueba el nombre del municipio antes que la variante capital", () => {
    expect(candidatosFotocasaDeNombre("Oleiros")).toEqual(["oleiros", "oleiros-capital"]);
    expect(candidatosFotocasaDeNombre("A Coruña")).toEqual(["a-coruna", "a-coruna-capital"]);
    expect(candidatosFotocasaDeNombre("15058")).toEqual([]);
  });

  it("saca el municipio del paréntesis de la dirección", () => {
    expect(nombreDesdeDireccion("Pazos", "AVENIDA ERNESTO CHE GUEVARA 142, Pazos (Oleiros)")).toBe("Oleiros");
    expect(nombreDesdeDireccion("Carballo", "RUA DOCTOR FLEMING 47, Carballo")).toBe("Carballo");
  });

  it("solo rellena slugs por defecto en A Coruña", () => {
    expect(slugsSiFaltan("15058", {}).fotocasa).toBeUndefined();
    expect(slugsSiFaltan("15030", {}).fotocasa).toBe("a-coruna-capital");
    expect(portalTieneSlug("fotocasa", {})).toBe(false);
    expect(portalTieneSlug("fotocasa", { fotocasa: "oleiros" })).toBe(true);
  });
});
