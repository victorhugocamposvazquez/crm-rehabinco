import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { agruparClusters, type FichaCluster } from "./cluster";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function piso(portal: string, price: number): FichaCluster {
  return {
    operation: "sale",
    mainType: "apartment",
    lat: 43.3654 + portal.length * 0.00001,
    lng: -8.4088,
    surface: 95,
    rooms: 3,
    price,
    active: true,
  };
}

describe("clúster entre portales", () => {
  it("tres tarjetas del mismo piso en tres portales son un comparable", () => {
    const grupos = agruparClusters([piso("fotocasa", 390000), piso("habitaclia", 395000), piso("pisos", 392000)]);
    expect(new Set(grupos).size).toBe(1);
  });

  it("mismo precio a menos de 100 m y superficie ±10 % es un clúster aunque las habitaciones no coincidan", () => {
    const base = piso("fotocasa", 390000);
    const otroPortal: FichaCluster = {
      ...piso("habitaclia", 390000),
      lng: base.lng! + 0.0009,
      surface: 100,
      rooms: 1,
    };
    const lejos: FichaCluster = { ...otroPortal, lng: base.lng! + 0.004, price: 390000 };
    const grupos = agruparClusters([base, otroPortal, lejos]);
    expect(grupos[0]).toBe(grupos[1]);
    expect(grupos[2]).not.toBe(grupos[0]);
  });

  it("un piso distinto no entra en el clúster", () => {
    const otro: FichaCluster = { ...piso("fotocasa", 390000), lat: 43.37, surface: 140, price: 500000 };
    const grupos = agruparClusters([piso("fotocasa", 390000), piso("habitaclia", 395000), otro]);
    expect(new Set(grupos).size).toBe(2);
  });

  it("avm_comparables se queda con uno por clúster", () => {
    const sql = readFileSync(path.join(root, "supabase/migrations/20261012180000_avm_b1_y_twin.sql"), "utf8");
    const cuerpo = sql.slice(sql.lastIndexOf("create or replace function avm_comparables"));
    expect(cuerpo).toContain("distinct on (coalesce(l.cluster_id, l.id))");
    expect(cuerpo).toContain("count(distinct coalesce(l.cluster_id, l.id))");
  });
});
