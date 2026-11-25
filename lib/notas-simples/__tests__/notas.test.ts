import { describe, expect, it } from "vitest";
import { notaReutilizable, puedePasar, rutaPdfNota, validarSolicitud, type NotaResumen } from "../modelo";
import { PROVEEDOR_MANUAL } from "../proveedor";
import { cargasVigentes, libreDeCargas } from "../resumen";

const base = { direccion: "Plaza de María Pita 12, A Coruña", motivo: "compraventa" };

describe("solicitud", () => {
  it("acepta referencia de 14 o 20, normalizando espacios y minúsculas", () => {
    const v = validarSolicitud({ ...base, refCatastral: "8923208 nj4082s" });
    expect(v.ok && v.solicitud.refCatastral).toBe("8923208NJ4082S");
    expect(validarSolicitud({ ...base, refCatastral: "8923208NJ4082S0001RT" }).ok).toBe(true);
  });
  it("exige una forma de identificar la finca, dirección y motivo", () => {
    const v = validarSolicitud({ motivo: "otro" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errores).toHaveLength(3);
    expect(validarSolicitud({ ...base, fincaRegistral: "12345", registro: "A Coruña 1" }).ok).toBe(true);
    expect(validarSolicitud({ ...base, refCatastral: "123" }).ok).toBe(false);
    expect(validarSolicitud({ ...base, idufir: "15001000123456" }).ok).toBe(true);
  });
});

describe("estados", () => {
  it("permite el flujo normal y bloquea saltos", () => {
    expect(puedePasar("solicitada", "en_tramite")).toBe(true);
    expect(puedePasar("en_tramite", "recibida")).toBe(true);
    expect(puedePasar("recibida", "leida")).toBe(true);
    expect(puedePasar("leida", "solicitada")).toBe(false);
    expect(puedePasar("cancelada", "solicitada")).toBe(false);
    expect(puedePasar("error", "solicitada")).toBe(true);
  });
});

describe("no pagar dos veces", () => {
  const ahora = new Date("2026-11-22T12:00:00Z");
  const nota = (p: Partial<NotaResumen>): NotaResumen => ({
    id: "a",
    estado: "leida",
    ref_catastral: "8923208NJ4082S0001RT",
    idufir: null,
    recibida_en: "2026-10-01T10:00:00Z",
    created_at: "2026-10-01T09:00:00Z",
    ...p,
  });
  it("reutiliza la nota del mismo inmueble de hace menos de 90 días", () => {
    expect(notaReutilizable([nota({})], { refCatastral: "8923208NJ4082S0001RT", idufir: null }, ahora)?.id).toBe("a");
  });
  it("no reutiliza la de otro piso del mismo edificio ni una caducada", () => {
    expect(notaReutilizable([nota({})], { refCatastral: "8923208NJ4082S0002YY", idufir: null }, ahora)).toBeNull();
    expect(notaReutilizable([nota({ recibida_en: "2026-07-01T10:00:00Z" })], { refCatastral: "8923208NJ4082S0001RT", idufir: null }, ahora)).toBeNull();
  });
  it("una pedida en curso siempre cuenta; con referencia de finca vale cualquier piso", () => {
    expect(notaReutilizable([nota({ id: "b", estado: "en_tramite", recibida_en: null })], { refCatastral: "8923208NJ4082S0001RT", idufir: null }, ahora)?.id).toBe("b");
    expect(notaReutilizable([nota({})], { refCatastral: "8923208NJ4082S", idufir: null }, ahora)?.id).toBe("a");
  });
});

describe("resumen y proveedor", () => {
  it("las afecciones fiscales y cargas canceladas no cuentan", () => {
    const cargas = [
      { tipo: "Hipoteca", detalle: null, acreedor: "Banco", importe: 120000, vigente: true },
      { tipo: "Afección fiscal", detalle: null, acreedor: null, importe: null, vigente: true },
      { tipo: "Embargo", detalle: null, acreedor: "AEAT", importe: 3000, vigente: false },
    ];
    expect(cargasVigentes({ cargas })).toEqual({ numero: 1, importe: 120000 });
    expect(libreDeCargas({ cargas: cargas.slice(1) })).toBe(true);
  });
  it("instrucciones del modo manual y ruta del PDF", () => {
    const v = validarSolicitud({ ...base, idufir: "15001000123456" });
    if (!v.ok) throw new Error("solicitud");
    expect(PROVEEDOR_MANUAL.instrucciones(v.solicitud)?.[1]).toContain("IDUFIR/CRU 15001000123456");
    expect(rutaPdfNota("x")).toBe("notas-simples/x.pdf");
  });
});
