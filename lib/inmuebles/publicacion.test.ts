import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avisoPublicacion, faltasIdealista, type DatosPublicacion } from "./publicacion";

const PISO: DatosPublicacion = {
  tipo_inmueble: "piso",
  tipo_operacion: "venta",
  precio_venta: "250000",
  precio_alquiler: "",
  direccion: "Rúa Juan Flórez 30",
  titulo: "Piso en Juan Flórez",
  codigo_postal: "15004",
  localidad: "A Coruña",
  superficie_m2: "86",
  superficie_construida: "86",
  superficie_parcela: "",
  habitaciones: "3",
  banos: "1",
  descripcion: "Piso exterior de tres habitaciones, reformado, junto a Juan Flórez.",
  certificado_energetico: "E",
  fotos: 4,
};

describe("publicación Idealista", () => {
  it("un piso completo no tiene faltas", () => {
    assert.deepEqual(faltasIdealista(PISO), []);
  });

  it("sin foto, certificado ni código postal no se puede marcar", () => {
    const faltas = faltasIdealista({
      ...PISO,
      codigo_postal: "1504",
      certificado_energetico: "",
      fotos: 0,
      descripcion: "Corto",
    });
    assert.ok(faltas.includes("código postal de 5 cifras"));
    assert.ok(faltas.includes("certificado energético"));
    assert.ok(faltas.includes("al menos una foto"));
    assert.ok(faltas.includes("descripción de al menos 50 caracteres"));
  });

  it("un garaje no pide habitaciones ni certificado", () => {
    const faltas = faltasIdealista({
      ...PISO,
      tipo_inmueble: "garaje",
      habitaciones: "",
      banos: "",
      certificado_energetico: "",
    });
    assert.deepEqual(faltas, []);
  });

  it("el aviso solo sale si el check está marcado", () => {
    assert.equal(avisoPublicacion({ ...PISO, publicar_web: false, publicar_idealista: false }, 0), null);
    assert.match(avisoPublicacion({ ...PISO, publicar_idealista: true, publicar_web: false, descripcion: "" }, 0) ?? "", /Idealista/);
  });
});
