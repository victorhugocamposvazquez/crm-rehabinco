import { describe, expect, it } from "vitest";
import { wizardScreens } from "../wizard-groups";

describe("flujo nueva valoración · pantallas agrupadas", () => {
  it("CRM sin unidad: 4 pantallas (inmueble, datos, estado, valorar)", () => {
    const s = wizardScreens("crm", false).map((x) => x.id);
    expect(s).toEqual(["address", "building", "state", "valorar"]);
  });

  it("CRM con unidad: 5 pantallas", () => {
    const s = wizardScreens("crm", true).map((x) => x.id);
    expect(s).toEqual(["address", "unit", "building", "state", "valorar"]);
  });

  it("Landing con unidad: 7 pantallas", () => {
    const s = wizardScreens("landing", true).map((x) => x.id);
    expect(s).toEqual(["address", "unit", "building", "state", "about", "email", "valorar"]);
  });
});
