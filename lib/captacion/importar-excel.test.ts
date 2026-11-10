import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { encargosDesdeHojas, encargosDesdeXlsx, partirNumero } from "./importar-excel";

const CABECERA = [
  "Calle",
  "Número",
  "Tipo/uso del inmueble",
  "Resultado / información del apunte",
  "Contacto / propietario",
  "Teléfono o email",
  "Operación",
  "Estado",
  "Próxima acción",
  "Notas de revisión",
];

describe("importar encargos", () => {
  it("no parte un portal si el número es dudoso", () => {
    assert.deepEqual(partirNumero("6, 4, 2"), { partes: ["6", "4", "2"], dudoso: false });
    assert.deepEqual(partirNumero("10, 15, 14, 11?"), { partes: ["10, 15, 14, 11?"], dudoso: true });
    assert.equal(partirNumero("¿28?").dudoso, true);
  });

  it("separa portales claros y marca el duplicado", () => {
    const { encargos, errores } = encargosDesdeHojas({
      Captación: [
        CABECERA,
        ["Plaza Egíptica", "1", "Viviendas", "venta", "", "", "Venta", "Seguimiento", "Revisar", ""],
        ["Entre casas", "6, 4", "Viviendas", "", "", "", "Por confirmar", "Pendiente", "Completar", ""],
        ["Plaza Egíptica", "1?", "Inmueble", "", "", "", "Venta", "Seguimiento", "Comprobar", "Puede ser duplicado"],
        ["Observatorio", "41", "Vivienda", "alquila", "José (apellido por confirmar)", "651 42 94 47 (confirmar)", "Alquiler", "Seguimiento", "Confirmar", ""],
      ],
      Calles: [
        ["Calle", "Números anotados", "Qué revisar / resumen", "Prioridad inicial", "Estado", "Notas"],
        ["Plaza Egíptica", "1", "", "Media", "Pendiente", ""],
        ["Observatorio", "41", "", "Alta", "En curso", ""],
      ],
    });
    assert.deepEqual(errores, []);
    assert.equal(encargos.length, 5);
    assert.equal(encargos[0]?.prioridad, "media");
    assert.equal(encargos[0]?.estado, "visita");
    assert.equal(encargos[1]?.numero, "6");
    assert.equal(encargos[2]?.numero, "4");
    assert.equal(encargos[3]?.posibleDuplicado, true);
    assert.equal(encargos[3]?.requiereConfirmacion, true);
    assert.equal(encargos[4]?.prioridad, "alta");
    assert.equal(encargos[4]?.telefono, "651 42 94 47 (confirmar)");
    assert.equal(encargos[4]?.operacion, "alquiler");
    assert.equal(encargos[4]?.requiereConfirmacion, true);
  });

  it("lee el excel de Sara si está en Descargas", async () => {
    const ruta = "/Users/hugocamposvazquez/Downloads/Captacion_inmobiliaria_apuntes_organizados.xlsx";
    if (!existsSync(ruta)) return;
    const { encargos, errores } = await encargosDesdeXlsx(readFileSync(ruta));
    assert.deepEqual(errores, []);
    assert.equal(encargos.length, 32);
    assert.ok(encargos.some((encargo) => encargo.posibleDuplicado && encargo.calle.includes("Egíptica")));
    assert.ok(encargos.filter((encargo) => encargo.calle === "Era Vella").length >= 7);
  });
});
