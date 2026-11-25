import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  centroide,
  direccionPrincipal,
  nombreVia,
  parseRecuadro,
  parsearEdificios,
  parsearPortales,
  unirPortales,
  urlEdificios,
} from "../inspire";
import { aplicarFiltros, buscarEdificios, csvDirecciones, FILTROS_VACIOS, ordenarEdificios } from "../filtros";

// Respuestas reales del WFS (A Coruña, plaza de María Pita, 22/11/2026), recortadas.
// En la de portales las referencias se han reasignado a los edificios de la muestra.
const fx = (f: string) => readFileSync(path.join(__dirname, "../__fixtures__", f)).toString("latin1");
const BU = fx("bu-coruna-maria-pita.gml");
const AD = fx("ad-coruna-maria-pita.gml");

describe("INSPIRE edificios", () => {
  const { edificios, posibleCorte } = parsearEdificios(BU);

  it("lee uso, año, inmuebles, viviendas y superficie", () => {
    expect(posibleCorte).toBe(false);
    expect(edificios.map((e) => e.ref)).toEqual(["8923208NJ4082S", "8923209NJ4082S", "8923210NJ4082S", "8923211NJ4082S"]);
    const e = edificios[0];
    expect(e).toMatchObject({ uso: "residencial", anio: 1882, inmuebles: 8, viviendas: 6, superficie: 1865, plantas: null, estado: "functional" });
    expect(edificios[3].uso).toBe("oficinas");
    expect(e.huella.length).toBe(6);
    expect(e.lat).toBeGreaterThan(43.3702);
    expect(e.lat).toBeLessThan(43.3706);
    expect(e.lng).toBeGreaterThan(-8.39755);
    expect(e.lng).toBeLessThan(-8.3974);
    expect(e.fotoUrl).toContain("ReferenciaCatastral=8923208NJ4082S");
  });

  it("une portales con vía y código postal", () => {
    const unidos = unirPortales(edificios, parsearPortales(AD));
    expect(unidos[0].direcciones[0]).toMatchObject({ via: "PZ MARIA PITA", numero: "12", codigoPostal: "15001" });
    expect(unidos[1].direcciones).toHaveLength(2);
    expect(direccionPrincipal(unidos[0])).toBe("Plaza Maria Pita, 12");
    expect(direccionPrincipal(unidos[2])).toBe("8923210NJ4082S");
  });

  it("centroide de un cuadrado", () => {
    const [lat, lng] = centroide([[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]);
    expect(lat).toBeCloseTo(1);
    expect(lng).toBeCloseTo(1);
  });
});

describe("recuadro", () => {
  it("acepta un recuadro pequeño en España y construye la URL lat,lon", () => {
    const r = parseRecuadro("43.3695,-8.3975,43.3705,-8.3955");
    expect(r).toEqual({ sur: 43.3695, oeste: -8.3975, norte: 43.3705, este: -8.3955 });
    expect(urlEdificios(r!)).toContain("bbox=43.3695%2C-8.3975%2C43.3705%2C-8.3955%2Curn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A4326");
  });
  it("rechaza recuadros grandes, invertidos o fuera de España", () => {
    expect(parseRecuadro("43.35,-8.42,43.38,-8.38")).toBeNull();
    expect(parseRecuadro("43.37,-8.39,43.36,-8.40")).toBeNull();
    expect(parseRecuadro("48.85,2.34,48.86,2.35")).toBeNull();
    expect(parseRecuadro("a,b,c,d")).toBeNull();
  });
});

describe("filtros y exportación", () => {
  const edificios = unirPortales(parsearEdificios(BU).edificios, parsearPortales(AD));

  it("filtra por uso, división horizontal, año e inmuebles", () => {
    expect(aplicarFiltros(edificios, { ...FILTROS_VACIOS, usos: ["oficinas"] }).map((e) => e.ref)).toEqual(["8923211NJ4082S"]);
    expect(aplicarFiltros(edificios, { ...FILTROS_VACIOS, division: "sin" })).toHaveLength(1);
    expect(aplicarFiltros(edificios, { ...FILTROS_VACIOS, division: "con" })).toHaveLength(3);
    expect(aplicarFiltros(edificios, { ...FILTROS_VACIOS, anioMin: 1882 })).toHaveLength(2);
    expect(aplicarFiltros(edificios, { ...FILTROS_VACIOS, inmueblesMin: 7 })).toHaveLength(2);
    expect(aplicarFiltros(edificios, { ...FILTROS_VACIOS, ocultarTrabajados: true }, new Set(["8923208NJ4082S"]))).toHaveLength(3);
  });

  it("busca por dirección sin tildes y por referencia; ordena por inmuebles", () => {
    expect(buscarEdificios(edificios, "maría pita 12").map((e) => e.ref)).toEqual(["8923208NJ4082S"]);
    expect(buscarEdificios(edificios, "8923211")).toHaveLength(1);
    expect(ordenarEdificios(edificios)[0].inmuebles).toBe(8);
  });

  it("CSV: una fila por portal, separador ; y BOM", () => {
    const csv = csvDirecciones(edificios, new Set(["8923209NJ4082S"]));
    const lineas = csv.trim().split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lineas).toHaveLength(1 + 5); // 4 edificios, uno con 2 portales
    expect(lineas[1]).toContain("8923208NJ4082S;Plaza Maria Pita, 12;Plaza Maria Pita;12;15001;Residencial;1882;8;6;1865;Sí;No;43,");
    expect(lineas[2]).toContain(";Sí;Sí;");
  });

  it("nombre de vía legible", () => {
    expect(nombreVia("CL RIEGO DE AGUA")).toBe("Calle Riego de Agua");
    expect(nombreVia("AV DO PORTO")).toBe("Avenida do Porto");
  });
});

import { etiquetaInmueble, recortarRecuadro } from "../inspire";

describe("utilidades del mapa", () => {
  it("recorta un recuadro grande a su centro", () => {
    const { recuadro, recortado } = recortarRecuadro({ sur: 43.35, oeste: -8.42, norte: 43.39, este: -8.36 });
    expect(recortado).toBe(true);
    expect((recuadro.norte + recuadro.sur) / 2).toBeCloseTo(43.37);
    expect(parseRecuadro([recuadro.sur, recuadro.oeste, recuadro.norte, recuadro.este].join(","))).not.toBeNull();
    expect(recortarRecuadro({ sur: 43.369, oeste: -8.398, norte: 43.371, este: -8.395 }).recortado).toBe(false);
  });
  it("etiqueta de inmueble", () => {
    expect(etiquetaInmueble({ escalera: "1", planta: "02", puerta: "A" })).toBe("Esc. 1 · Planta 02 · Puerta A");
    expect(etiquetaInmueble({ escalera: null, planta: "BJ", puerta: null })).toBe("BJ");
    expect(etiquetaInmueble({ escalera: null, planta: null, puerta: null })).toBe("Inmueble");
  });
});
