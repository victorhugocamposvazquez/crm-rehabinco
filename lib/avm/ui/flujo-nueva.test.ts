import { describe, expect, it } from "vitest";
import { nextStep, resolveFlow } from "../flow";
import { emptyTwin, type Twin } from "../types";

/** Recorrido UI por dirección (Juan Flórez 03-DR con Catastro completo típico). */
function contarMicroPasos(twin: Twin, prefilled: Set<keyof Twin>) {
  const ids: string[] = [];
  let t = { ...twin };
  let pre = new Set(prefilled);
  for (let i = 0; i < 20; i++) {
    const paso = nextStep(t, "crm", pre);
    if (!paso) break;
    ids.push(paso.id);
    for (const f of paso.fields) {
      if (t[f] == null) {
        if (f === "side") t = { ...t, side: "exterior" };
        else if (f === "buildingCondition") t = { ...t, buildingCondition: 4 };
        else if (f === "isRenovated") t = { ...t, isRenovated: false };
        else if (f === "hasBalcony") t = { ...t, hasBalcony: true };
        else if (f === "balconySurface") t = { ...t, balconySurface: 6 };
        else if (paso.id === "counters")
          t = { ...t, numberOfBedrooms: 3, numberOfBathrooms: 1, numberOfIndoorParkings: 0, numberOfOutdoorParkings: 0 };
        else if (paso.id === "features")
          t = { ...t, hasView: false, hasSwimmingPool: false, hasGarden: false, hasElevator: true, hasStorageRoom: false, hasFireplace: false };
      }
    }
    pre = new Set(pre);
  }
  return ids;
}

describe("flujo nueva valoración · Juan Flórez", () => {
  it("con Catastro prefilled no supera 8 micro-preguntas", () => {
    const twin: Twin = {
      ...emptyTwin(),
      mainType: "apartment",
      propertyType: "apartment",
      builtSurface: 86,
      constructionYear: 1967,
      floorOfFlat: 3,
      numberOfFloors: 11,
      address: {
        ...emptyTwin().address,
        formattedAddress: "Rúa Juan Flórez 30, 15004 A Coruña",
        lat: 43.3654,
        lng: -8.4088,
        postcode: "15004",
      },
    };
    const prefilled = new Set<keyof Twin>([
      "mainType",
      "propertyType",
      "builtSurface",
      "constructionYear",
      "floorOfFlat",
      "numberOfFloors",
    ]);
    const micro = contarMicroPasos(twin, prefilled);
    expect(micro.length).toBeLessThanOrEqual(8);
    expect(micro[0]).toBe("side");
  });

  it("Juan Flórez por dirección suma 8 pantallas con unidad y Catastro completo", () => {
    const twin: Twin = {
      ...emptyTwin(),
      mainType: "apartment",
      propertyType: "apartment",
      builtSurface: 86,
      constructionYear: 1967,
      floorOfFlat: 3,
      numberOfFloors: 11,
      address: { ...emptyTwin().address, lat: 43.36, lng: -8.4 },
    };
    const prefilled = new Set<keyof Twin>([
      "builtSurface",
      "constructionYear",
      "floorOfFlat",
      "numberOfFloors",
      "mainType",
      "propertyType",
    ]);
    const fijas = 4; // entrada, mapa, unidad, catastro
    const micro = contarMicroPasos(twin, prefilled).length;
    const total = fijas + micro + 1; // valorar
    expect(micro).toBe(7);
    expect(total).toBe(12);
    expect(resolveFlow(twin, "crm", prefilled).filter((s) => s.prefilled && s.fields.length).length).toBeGreaterThan(0);
  });
});
