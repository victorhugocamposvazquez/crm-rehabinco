import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buscarInmuebleDuplicado } from "./dedup";

describe("dedup inmuebles", () => {
  it("une por teléfono + municipio + m² ±5%", () => {
    const match = buscarInmuebleDuplicado(
      {
        id: "n",
        operacion: "venta",
        tipo: "piso",
        municipio: "Cambre",
        superficie: 82,
        habitaciones: 3,
        lat: null,
        lng: null,
        geo_aproximada: false,
        contacto_telefono: "+34600111222",
        phash_fotos: [],
      },
      [
        {
          id: "e1",
          operacion: "venta",
          tipo: "piso",
          municipio: "Cambre",
          superficie: 80,
          habitaciones: 3,
          lat: null,
          lng: null,
          geo_aproximada: false,
          contacto_telefono: "+34600111222",
          phash_fotos: [],
        },
      ]
    );
    assert.equal(match?.id, "e1");
    assert.equal(match?.motivo.regla, "telefono_municipio_m2");
  });
});
