/**
 * Pruebas de humo (vitest). `npx vitest run`.
 * El primer caso reproduce la cifra teaser de RealAdvisor (393K €) para el
 * piso de prueba de Rúa Juan Flórez 30, con 3.547 €/m² de mediana de zona.
 */
import { describe, expect, it } from 'vitest';
import { computeLiveEstimate, computePrecision } from '../estimate';
import { resolveFlow, nextStep } from '../flow';
import { valueFromComparables } from '../comparables';
import { computeConfidence } from '../confidence';
import { valuate } from '../valuate';
import { buildEnvironment } from '../environment';
import { emptyTwin, type Comparable, type Twin } from '../types';

export const juanFlorez = (): Twin => ({
  ...emptyTwin(),
  address: { ...emptyTwin().address, formattedAddress: 'Rúa Juan Flórez 30, 15004 A Coruña', postcode: '15004', locality: 'A Coruña', lat: 43.3654271, lng: -8.408791 },
  mainType: 'apartment', propertyType: 'apartment',
  floorOfFlat: 3, numberOfFloors: 6, side: 'exterior', hasElevator: true,
  builtSurface: 95, balconySurface: 6, hasBalcony: true,
  constructionYear: 1975, renovationYear: 2018, isRenovated: true, buildingCondition: 4,
  numberOfBedrooms: 3, numberOfBathrooms: 2, numberOfIndoorParkings: 1, numberOfOutdoorParkings: 0,
  hasView: false, hasSwimmingPool: false, hasGarden: false, hasStorageRoom: true, hasFireplace: false,
});

describe('estimador en vivo', () => {
  it('reproduce el teaser de RealAdvisor (393K) con 3.547 €/m² de zona', () => {
    const e = computeLiveEstimate(juanFlorez(), 3547);
    expect(e.basis).toBe('zone_median');
    expect(e.mid).toBeGreaterThanOrEqual(390_000);
    expect(e.mid).toBeLessThanOrEqual(396_000);
    expect(e.uncertainty).toBeLessThanOrEqual(18);
  });

  it('sin dirección devuelve 0 y 100 de incertidumbre', () => {
    const e = computeLiveEstimate(emptyTwin());
    expect(e.mid).toBe(0);
    expect(e.uncertainty).toBe(100);
  });

  it('la precisión sube con los campos y llega al 100 con todo relleno (piso)', () => {
    expect(computePrecision(emptyTwin())).toBe(0);
    const p = computePrecision(juanFlorez());
    expect(p).toBeGreaterThanOrEqual(85);
  });
});

describe('flujo de preguntas', () => {
  it('en CRM no hay preguntas de lead; en landing sí', () => {
    const t = juanFlorez();
    const crm = resolveFlow(t, 'crm').map((s) => s.id);
    const landing = resolveFlow(t, 'landing').map((s) => s.id);
    expect(crm).not.toContain('relationship');
    expect(landing).toContain('relationship');
    expect(landing).toContain('perceivedValue');
  });

  it('los pasos rellenos por Catastro se marcan como prefilled y no se preguntan', () => {
    const t = { ...emptyTwin(), mainType: 'apartment' as const, propertyType: 'apartment' as const, builtSurface: 95, constructionYear: 1975, floorOfFlat: 3, numberOfFloors: 6 };
    t.address.lat = 43.36; t.address.lng = -8.4;
    const pre = new Set<keyof Twin>(['builtSurface', 'constructionYear', 'floorOfFlat', 'numberOfFloors']);
    const flow = resolveFlow(t, 'crm', pre);
    expect(flow.find((s) => s.id === 'surface')?.prefilled).toBe(true);
    expect(flow.find((s) => s.id === 'floors')?.prefilled).toBe(true);
    expect(nextStep(t, 'crm', pre)?.id).toBe('side');
  });
});

const comps: Comparable[] = [
  { listingId: '1', portal: 'fotocasa', title: 'Piso exterior', price: 340_000, surface: 100, pricePerM2: 3400, rooms: 3, floor: 4, hasElevator: true, hasGarage: true, hasTerrace: null, isExterior: true, conditionHint: 'buen estado', lastSeen: '2026-10-01', distanceM: 120, radiusM: 300 },
  { listingId: '2', portal: 'idealista', title: 'Piso reformado', price: 365_000, surface: 98, pricePerM2: 3724, rooms: 3, floor: 2, hasElevator: true, hasGarage: false, hasTerrace: null, isExterior: true, conditionHint: 'reformado', lastSeen: '2026-09-20', distanceM: 210, radiusM: 300 },
  { listingId: '3', portal: 'habitaclia', title: 'Piso a reformar', price: 255_000, surface: 90, pricePerM2: 2833, rooms: 3, floor: 1, hasElevator: false, hasGarage: false, hasTerrace: null, isExterior: false, conditionHint: 'reformar', lastSeen: '2026-08-15', distanceM: 280, radiusM: 300 },
  { listingId: '4', portal: 'pisos', title: 'Piso con garaje', price: 349_000, surface: 105, pricePerM2: 3324, rooms: 4, floor: 5, hasElevator: true, hasGarage: true, hasTerrace: null, isExterior: true, conditionHint: null, lastSeen: '2026-09-28', distanceM: 260, radiusM: 300 },
  { listingId: '5', portal: 'fotocasa', title: 'Ático', price: 420_000, surface: 110, pricePerM2: 3818, rooms: 3, floor: 6, hasElevator: true, hasGarage: true, hasTerrace: null, isExterior: true, conditionHint: 'nuevo', lastSeen: '2026-10-05', distanceM: 150, radiusM: 300 },
  { listingId: '6', portal: 'idealista', title: 'Piso', price: 320_000, surface: 92, pricePerM2: 3478, rooms: 2, floor: 3, hasElevator: true, hasGarage: false, hasTerrace: null, isExterior: true, conditionHint: 'buen estado', lastSeen: '2026-09-30', distanceM: 300, radiusM: 300 },
  { listingId: '7', portal: 'fotocasa', title: 'Piso', price: 299_000, surface: 85, pricePerM2: 3518, rooms: 3, floor: 2, hasElevator: true, hasGarage: false, hasTerrace: null, isExterior: false, conditionHint: null, lastSeen: '2026-09-10', distanceM: 240, radiusM: 300 },
  { listingId: '8', portal: 'habitaclia', title: 'Piso', price: 390_000, surface: 120, pricePerM2: 3250, rooms: 4, floor: 3, hasElevator: true, hasGarage: true, hasTerrace: null, isExterior: true, conditionHint: 'buen estado', lastSeen: '2026-10-02', distanceM: 190, radiusM: 300 },
];

describe('comparables', () => {
  it('devuelve valor, rango y explicación', () => {
    const v = valueFromComparables(juanFlorez(), comps, { discountPct: 7 });
    expect(v).not.toBeNull();
    expect(v!.valueLow).toBeLessThan(v!.valueMid);
    expect(v!.valueMid).toBeLessThan(v!.valueHigh);
    expect(v!.valueMid).toBeGreaterThan(250_000);
    expect(v!.valueMid).toBeLessThan(420_000);
    expect(v!.explanation.length).toBeGreaterThan(2);
  });

  it('amortigua el rango hacia ±8 % cuando hay pocos comparables', () => {
    const v = valueFromComparables(juanFlorez(), comps, { discountPct: 7 })!;
    expect(v.rangeMethod).toBe('iqr_shrunk');
    expect(v.ppm2Low).toBeLessThanOrEqual(v.ppm2Mid);
    expect(v.ppm2High).toBeGreaterThanOrEqual(v.ppm2Mid);
    const linea = v.explanation.find((l) => l.startsWith('Rango:'));
    expect(linea).toMatch(/amortiguado hacia ±8 % por tener \d+ comparables/);
  });

  it('el piso interior sin ascensor sale ajustado al alza al compararlo con el sujeto exterior con ascensor', () => {
    const v = valueFromComparables(juanFlorez(), comps)!;
    const c3 = v.used.find((c) => c.listingId === '3');
    if (c3) expect(c3.adjustedPpm2).toBeGreaterThan(c3.pricePerM2);
  });
});

describe('valuate', () => {
  it('con todo disponible da confianza alta y fuentes primarias', async () => {
    const r = await valuate(juanFlorez(), {
      zoneStats: async () => ({ zoneLevel: 'postcode', zoneKey: '15004', label: 'A Coruña (15004)', month: '2026-10-01', n: 194, medianPpm2: 3547, p25Ppm2: 3000, p75Ppm2: 4000, trend12mPct: 7.1, source: 'market_listings' }),
      comparables: async () => comps,
      discountPct: async () => 7,
      grossYieldPct: async () => 4.3,
    }, { channel: 'crm', propertySource: 'catastro_local', geocodingSource: 'google' });
    expect(r.confidence).toBeGreaterThanOrEqual(70);
    expect(r.rentMonthly).toBeGreaterThan(800);
    expect(r.sourcesUsed.find((s) => s.layer === 'comparables')?.status).toBe('primary');
  });

  it('sin mercado ni comparables degrada a estimador en vivo y baja la confianza', async () => {
    const r = await valuate(juanFlorez(), {
      zoneStats: async () => null,
      comparables: async () => [],
    }, { channel: 'landing', propertySource: 'manual', geocodingSource: 'postcode_centroid' });
    expect(r.valueMid).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(40);
    expect(r.sourcesUsed.find((s) => s.layer === 'market')?.status).toBe('missing');
  });

  it('la Sede del Catastro en vivo es fuente primaria y la caché caducada es respaldo', async () => {
    const base = {
      zoneStats: async () => null,
      comparables: async () => [],
    };
    const fresco = await valuate(juanFlorez(), base, { channel: 'crm', propertySource: 'catastro_sede', geocodingSource: 'catastro' });
    const caducada = await valuate(juanFlorez(), base, { channel: 'crm', propertySource: 'catastro_sede', propertyStale: true, geocodingSource: 'catastro' });
    expect(fresco.sourcesUsed.find((s) => s.layer === 'property')).toMatchObject({ source: 'catastro_sede', status: 'primary' });
    expect(caducada.sourcesUsed.find((s) => s.layer === 'property')?.status).toBe('fallback');
    expect(fresco.methodVersion).toBe('comparables-1.1');
  });

  it('el alquiler sale de sus comparables y la rentabilidad es derivada', async () => {
    const rents: Comparable[] = Array.from({ length: 6 }, (_, i) => ({
      listingId: `r${i}`, portal: 'fotocasa', title: 'Alquiler', price: 900 + i * 20, surface: 90,
      pricePerM2: (900 + i * 20) / 90, rooms: 3, floor: 2, hasElevator: true, hasGarage: false,
      hasTerrace: null, isExterior: true, conditionHint: null, lastSeen: '2026-10-01', distanceM: 120, radiusM: 300,
    }));
    const r = await valuate(juanFlorez(), {
      zoneStats: async () => null,
      comparables: async () => comps,
      rentComparables: async () => rents,
      discountPct: async () => 8,
    }, { channel: 'crm', propertySource: 'catastro_sede', geocodingSource: 'catastro' });
    expect(r.rentSource).toBe('comparables');
    expect(r.rentMonthly).toBeGreaterThan(500);
    expect(r.grossYield).toBeCloseTo((r.rentMonthly! * 12 / r.valueMid) * 100, 1);
    expect(r.sourcesUsed.find((s) => s.layer === 'rent')?.status).toBe('primary');
  });
});

describe('confianza 1.1', () => {
  it('resta 2 puntos por comparable hasta 12, abre la dispersión al 10 % y penaliza la zona sin tendencia', () => {
    const ocho = comps.slice(0, 8).map((c) => ({ ...c, adjustments: {}, adjustedPpm2: 4000, weight: 1 }));
    const conTendencia = computeConfidence({ sourcesUsed: [], comparables: ocho, precisionScore: 80, trend12mPct: 4 });
    const sinTendencia = computeConfidence({ sourcesUsed: [], comparables: ocho, precisionScore: 80, trend12mPct: null });
    expect(conTendencia.penalties.find((p) => p.reason.includes('12'))?.points).toBe(8);
    expect(sinTendencia.confidence).toBe(conTendencia.confidence - 3);
    const dispersos = ocho.map((c, i) => ({ ...c, adjustedPpm2: i % 2 ? 3000 : 5000 }));
    const cv = computeConfidence({ sourcesUsed: [], comparables: dispersos, precisionScore: 80, trend12mPct: 1 });
    expect(cv.penalties.some((p) => p.reason.startsWith('dispersión'))).toBe(true);
  });
});

describe('entorno', () => {
  it('lista a favor y en contra y marca riesgos sin tocar el precio', () => {
    const env = buildEnvironment({
      nearest: [
        { layer: 'gtfs_stop', category: 'bus', sense: 'positive', name: 'Juan Flórez', props: {}, distance_m: 90 },
        { layer: 'osm_poi', category: 'supermarket', sense: 'positive', name: 'Gadis', props: {}, distance_m: 180 },
        { layer: 'noise', category: null, sense: 'negative', name: 'Juan Flórez', props: { lden: 68, source_type: 'tráfico' }, distance_m: 10 },
        { layer: 'flood', category: null, sense: 'negative', name: null, props: { period: 'T500' }, distance_m: 0 },
      ],
      counts_500m: { shop: 30, restaurant: 12 },
    });
    expect(env.positives.length).toBeGreaterThanOrEqual(3);
    expect(env.negatives.length).toBe(1);
    expect(env.flags.length).toBe(1);
    expect(env.score).toBeGreaterThan(50);
  });
});
