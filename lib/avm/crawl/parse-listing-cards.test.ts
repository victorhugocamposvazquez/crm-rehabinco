import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseListingCardsFotocasa } from "../market/fotocasa-cards";
import { parseListingCardsHabitaclia } from "../market/habitaclia-cards";
import { parseListingCardsPisos } from "../market/pisos-cards";
import { ingestaDesdeCaptacionActiva } from "./from-captacion";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");

describe("parseListingCards", () => {
  it("lee una tarjeta de Fotocasa y marca exactas las coordenadas del portal", () => {
    const page = parseListingCardsFotocasa(readFileSync(path.join(fixtures, "fotocasa.html"), "utf8"), "sale");
    expect(page.cards).toHaveLength(1);
    expect(page.total).toBe(1);
    const card = page.cards[0];
    expect(card.portal).toBe("fotocasa");
    expect(card.price).toBe(295000);
    expect(card.surface).toBe(67);
    expect(card.rooms).toBe(2);
    expect(card.hasElevator).toBe(true);
    expect(card.locationPrecision).toBe("exact");
    expect(card.zoneSlug).toBe("los-castros-castrillon");
    expect(card.postcode).toBe("15006");
    expect(card.isAgency).toBe(true);
  });

  it("lee una tarjeta de Habitaclia aunque la visibilidad no sea el punto exacto", () => {
    const page = parseListingCardsHabitaclia(readFileSync(path.join(fixtures, "habitaclia.html"), "utf8"), "sale");
    expect(page.cards).toHaveLength(1);
    const card = page.cards[0];
    expect(card.portal).toBe("habitaclia");
    expect(card.price).toBe(265000);
    expect(card.surface).toBe(94);
    expect(card.conditionHint).toBe("reformar");
    expect(card.hasGarage).toBe(true);
    expect(card.locationPrecision).toBe("exact");
    expect(card.zoneSlug).toBe("sagrada-familia");
  });

  it("lee una tarjeta de pisos.com sin tomar el número de la calle como planta", () => {
    const page = parseListingCardsPisos(readFileSync(path.join(fixtures, "pisos.html"), "utf8"), "sale", "piso");
    expect(page.cards).toHaveLength(1);
    expect(page.total).toBe(282);
    const card = page.cards[0];
    expect(card.portal).toBe("pisos");
    expect(card.mainType).toBe("apartment");
    expect(card.price).toBe(270000);
    expect(card.surface).toBe(80);
    expect(card.rooms).toBe(2);
    expect(card.floor).toBe(3);
    expect(card.locationPrecision).toBe("exact");
    expect(card.zoneSlug).toBe("os-mallos-a-falperra");
    expect(card.postcode).toBe("15005");
  });

  it("no vuelca captación mientras el flag está apagado", () => {
    const previo = process.env.AVM_INGEST_FROM_CAPTACION;
    delete process.env.AVM_INGEST_FROM_CAPTACION;
    expect(ingestaDesdeCaptacionActiva()).toBe(false);
    if (previo === undefined) delete process.env.AVM_INGEST_FROM_CAPTACION;
    else process.env.AVM_INGEST_FROM_CAPTACION = previo;
  });
});
