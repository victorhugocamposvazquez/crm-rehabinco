import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularEstadisticasEquipo,
  enRangoFecha,
  formatoEurosCorto,
  rangoFechasPeriodo,
  type EstadisticasRawInput,
} from "./calcular";

const baseRaw = (): EstadisticasRawInput => ({
  usuarios: [
    { id: "u1", nombre: "Ana Oro", email: "ana@rehabinco.es", role: "comercial", color: "#E11D48" },
    { id: "u2", nombre: "Beto Plata", email: "beto@rehabinco.es", role: "comercial", color: "#2563EB" },
    { id: "u3", nombre: "Carla Bronce", email: "carla@rehabinco.es", role: "admin", color: "#16A34A" },
  ],
  propiedades: [],
  partesVisita: [],
  citas: [],
  arras: [],
  pagoAplazado: [],
  arrendamientos: [],
  hojasEncargo: [],
  fincas: [],
  encargosCalle: [],
  demandas: [],
  notasClientes: [],
  tareas: [],
  valoraciones: [],
});

describe("rangoFechasPeriodo y enRangoFecha", () => {
  it("calcula el inicio de mes, trimestre y año en ISO", () => {
    const ref = new Date("2026-11-10T12:00:00Z");
    assert.deepEqual(rangoFechasPeriodo("mes", ref), {
      desde: "2026-11-01",
      hasta: "2026-11-10",
    });
    assert.deepEqual(rangoFechasPeriodo("trimestre", ref), {
      desde: "2026-10-01",
      hasta: "2026-11-10",
    });
    assert.deepEqual(rangoFechasPeriodo("anio", ref), {
      desde: "2026-01-01",
      hasta: "2026-11-10",
    });
    assert.deepEqual(rangoFechasPeriodo("todo", ref), {
      desde: null,
      hasta: "2026-11-10",
    });
    assert.equal(enRangoFecha("2026-11-05T10:00:00Z", "2026-11-01", "2026-11-10"), true);
    assert.equal(enRangoFecha("2026-10-31T23:59:59Z", "2026-11-01", "2026-11-10"), false);
  });
});

describe("calcularEstadisticasEquipo y podio Oro, Plata, Bronce", () => {
  it("calcula puntos XP, captaciones individuales/compartidas, visitas, cierres y ordena el podio", () => {
    const raw = baseRaw();
    const ahora = new Date("2026-11-10T12:00:00Z");

    raw.propiedades = [
      {
        id: "p1",
        userId: "u1",
        comercialId: "u1",
        captadoPor: "u1",
        captadoConjunto: false,
        captadoresIds: ["u1"],
        estado: "vendida",
        tipoOperacion: "venta",
        precioVenta: 280000,
        precioAlquiler: null,
        publicado: true,
        publicarWeb: true,
        publicarIdealista: true,
        createdAt: "2026-11-02T10:00:00Z",
        updatedAt: "2026-11-08T10:00:00Z",
      },
      {
        id: "p2",
        userId: "u2",
        comercialId: "u2",
        captadoPor: null,
        captadoConjunto: true,
        captadoresIds: ["u1", "u2"],
        estado: "disponible",
        tipoOperacion: "venta",
        precioVenta: 200000,
        precioAlquiler: null,
        publicado: true,
        publicarWeb: true,
        publicarIdealista: false,
        createdAt: "2026-11-04T10:00:00Z",
        updatedAt: "2026-11-04T10:00:00Z",
      },
    ];

    raw.hojasEncargo = [
      {
        id: "h1",
        userId: "u1",
        comercialId: "u1",
        tipo: "exclusiva",
        estado: "cerrado",
        precio: 280000,
        fecha: "2026-11-03",
        createdAt: "2026-11-03T10:00:00Z",
      },
    ];

    raw.partesVisita = [
      {
        id: "v1",
        userId: "u2",
        comercialId: "u2",
        estado: "firmado",
        fechaVisita: "2026-11-05",
        createdAt: "2026-11-05T10:00:00Z",
      },
      {
        id: "v2",
        userId: "u2",
        comercialId: "u2",
        estado: "firmado",
        fechaVisita: "2026-11-06",
        createdAt: "2026-11-06T10:00:00Z",
      },
      {
        id: "v3",
        userId: "u3",
        comercialId: "u3",
        estado: "borrador",
        fechaVisita: "2026-11-07",
        createdAt: "2026-11-07T10:00:00Z",
      },
    ];

    raw.fincas = [
      {
        fincaReference: "FINCA1",
        comercialId: "u3",
        estado: "propietario_localizado",
        conPropiedad: false,
        assignedAt: "2026-11-01T09:00:00Z",
        updatedAt: "2026-11-05T09:00:00Z",
      },
    ];

    const res = calcularEstadisticasEquipo(raw, { periodo: "mes", ahora });

    assert.equal(res.resumen.captacionesTotales, 2);
    assert.equal(res.resumen.exclusivasTotales, 1);
    assert.equal(res.resumen.visitasTotales, 3);
    assert.equal(res.resumen.visitasFirmadas, 2);
    assert.equal(res.resumen.operacionesCerradas, 1);
    assert.equal(res.resumen.volumenIntermediadoEur, 280000);

    // Verificar podio XP: u1 es Oro, u2 es Plata, u3 es Bronce
    const podioXp = res.podios.xp;
    assert.equal(podioXp.length, 3);
    assert.equal(podioXp[0]?.medalla, "oro");
    assert.equal(podioXp[0]?.userId, "u1");
    assert.equal(podioXp[1]?.medalla, "plata");
    assert.equal(podioXp[1]?.userId, "u2");
    assert.equal(podioXp[2]?.medalla, "bronce");
    assert.equal(podioXp[2]?.userId, "u3");

    // Verificar podio de Visitas: u2 es Oro (2 partes firmados)
    assert.equal(res.podios.visitas[0]?.userId, "u2");
    assert.equal(res.podios.visitas[0]?.medalla, "oro");

    // Verificar captaciones compartidas en u1 y u2
    const statAna = res.usuarios.find((u) => u.userId === "u1")!;
    assert.equal(statAna.captaciones.total, 2);
    assert.equal(statAna.captaciones.individuales, 1);
    assert.equal(statAna.captaciones.compartidas, 1);
    assert.equal(statAna.captaciones.puntosPonderados, 1.5);
    assert.equal(statAna.insignias.some((i) => i.id === "rey_exclusiva"), true);
    assert.equal(statAna.insignias.some((i) => i.id === "closer"), true);

    assert.equal(formatoEurosCorto(280000), "280 mil €");
  });
});
