import { describe, expect, it } from "vitest";
import { correccionDeLugar, esJamoneria } from "../osm-correcciones";

describe("correcciones de OSM", () => {
  it("La Dehesa junto a Juan Flórez no es un pub", () => {
    const c = correccionDeLugar("La Dehesa", "pub", 43.3655, -8.4087);
    expect(c?.category).toBe("hospitality");
    expect(c?.nota).toMatch(/jamonería/);
  });

  it("un pub llamado La Dehesa en otra ciudad sigue siendo pub", () => {
    expect(correccionDeLugar("La Dehesa", "pub", 40.4168, -3.7038)).toBeNull();
  });

  it("otro pub al lado de Juan Flórez no entra en la excepción", () => {
    expect(correccionDeLugar("Auria Bar", "pub", 43.3655, -8.4087)).toBeNull();
  });

  it("el nombre jamonería no es ocio nocturno", () => {
    expect(esJamoneria("Jamonería La Encina")).toBe(true);
    expect(esJamoneria("La Dehesa")).toBe(false);
  });
});
