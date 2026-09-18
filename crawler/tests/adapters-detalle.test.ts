import { describe, expect, it } from "vitest";
import "../src/adapters/habitaclia/index.js";
import { habitacliaAdapter } from "../src/adapters/habitaclia/adapter.js";
import { debeEncolarDetalle } from "../src/adapters/types.js";

describe("detalleNecesario", () => {
  it("Habitaclia no encola detalle automático", () => {
    expect(habitacliaAdapter.detalleNecesario).toBe("nunca");
    expect(
      debeEncolarDetalle("nunca", {
        esNuevo: true,
        tieneBuildDetailUrl: true,
        contactoTelefono: null,
      })
    ).toBe(false);
  });

  it("sin_telefono solo encola si falta teléfono", () => {
    expect(
      debeEncolarDetalle("sin_telefono", {
        esNuevo: true,
        tieneBuildDetailUrl: true,
        contactoTelefono: "+34600111222",
      })
    ).toBe(false);
    expect(
      debeEncolarDetalle("sin_telefono", {
        esNuevo: true,
        tieneBuildDetailUrl: true,
        contactoTelefono: null,
      })
    ).toBe(true);
  });
});
