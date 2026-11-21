/**
 * Series oficiales: lectores (MIVAU, INE), cruce de nombres y referencia oficial.
 *
 * Las muestras de `fixtures/mivau-muestras.json` son filas reales de los .xls
 * del Ministerio (2T 2026) leídas con `leerXls`, recortadas. En la tabla de
 * compraventas se han quitado años y algunas cifras (A Coruña, Madrid,
 * Oza-Cesuras) son inventadas para el test.
 */
import { describe, expect, it } from 'vitest';
import muestras from './fixtures/mivau-muestras.json';
import type { HojaXls } from '../xls';
import { flujoWorkbook, rk } from '../xls';
import {
  columnasPeriodo, parseTasadoMunicipios, parseTasadoProvincias, parseTransaccionesMunicipios, periodoHoja,
} from '../mivau';
import { parseIpv, type SerieIne } from '../ine-ipv';
import { ambitoDeNombre, CatalogoMunicipios, claveNombre, codigoProvincia } from '../territorio';
import { filasIpv, filasTasadoMunicipios, filasTasadoTerritorio, filasTransacciones } from '../filas';
import { buildOfficialReference, explicacionOficial, zoneStatsDesdeReferencia, type FilaCierre } from '../referencia';

const hoja = (h: { nombre: string; filas: unknown[][] }) => h as HojaXls;

const CATALOGO = new CatalogoMunicipios([
  { ine: '15002', nombres: ['Ames', 'AMES'] },
  { ine: '15005', nombres: ['Arteixo', 'ARTEIXO'] },
  { ine: '15019', nombres: ['Carballo'] },
  { ine: '15030', nombres: ['Coruña, A', 'CORUÑA (A)'] },
  { ine: '15001', nombres: ['Abegondo'] },
  { ine: '15902', nombres: ['Oza-Cesuras', 'OZA-CESURAS'] },
  { ine: '04013', nombres: ['Almería'] },
  { ine: '04079', nombres: ['Roquetas de Mar'] },
  { ine: '04066', nombres: ['Níjar'] },
  { ine: '04001', nombres: ['Abla'] },
  { ine: '28079', nombres: ['Madrid'] },
  { ine: '27028', nombres: ['Lugo'] },
  { ine: '32054', nombres: ['Ourense'] },
  // Nombre repetido en dos provincias
  { ine: '36038', nombres: ['Ponteareas'] },
  { ine: '15078', nombres: ['Santiago de Compostela'] },
  { ine: '33001', nombres: ['Allande'] },
  { ine: '15099', nombres: ['Mesía'] },
  { ine: '27099', nombres: ['Mesía'] },
]);

describe('lector .xls', () => {
  it('decodifica valores RK (entero, entero/100 y coma flotante)', () => {
    expect(rk((123 << 2) | 2)).toBe(123);
    expect(rk((12345 << 2) | 3)).toBe(123.45);
    // 1.5 en IEEE754: 0x3FF80000 en la palabra alta
    expect(rk(0x3ff80000)).toBe(1.5);
  });

  it('rechaza lo que no es un contenedor OLE', () => {
    expect(() => flujoWorkbook(new Uint8Array(512))).toThrow(/firma OLE/);
  });
});

describe('nombres y territorio', () => {
  it('casa las variantes de artículo y tildes', () => {
    const k = claveNombre('A Coruña');
    expect(claveNombre('Coruña (A)')).toBe(k);
    expect(claveNombre('Coruña, A')).toBe(k);
    expect(claveNombre('La Coruña')).toBe(k);
    expect(claveNombre('CORUÑA (A)')).toBe(k);
    expect(claveNombre('Ejido (El)')).toBe(claveNombre('El Ejido'));
    expect(claveNombre('Oza-Cesuras * Unión de municipios Oza y Cesuras')).toBe(claveNombre('Oza-Cesuras'));
  });

  it('reconoce provincias y comunidades uniprovinciales', () => {
    expect(codigoProvincia('Coruña (A)')).toBe('15');
    expect(codigoProvincia('Almería           ')).toBe('04');
    expect(codigoProvincia('Alicante/Alacant')).toBe('03');
    expect(codigoProvincia('Araba/Alava')).toBe('01');
    expect(ambitoDeNombre('MADRID (COMUNIDAD DE)')).toEqual({ provincia: '28', ccaa: '13' });
    expect(ambitoDeNombre('Asturias (Principado de )')).toEqual({ provincia: '33', ccaa: '03' });
    expect(ambitoDeNombre('Navarra (Com. Foral de)')).toEqual({ provincia: '31', ccaa: '15' });
    expect(ambitoDeNombre('GALICIA')).toEqual({ provincia: null, ccaa: '12' });
    expect(ambitoDeNombre('Ceuta y Melilla')).toEqual({ provincia: null, ccaa: null });
  });

  it('resuelve municipios aunque la pista de provincia venga arrastrada', () => {
    // Ames sale debajo de Almería en la tabla de valor tasado
    expect(CATALOGO.resolver('Ames', '04')).toBe('15002');
    expect(CATALOGO.resolver('Coruña (A)', '15')).toBe('15030');
    // Nombre repetido: decide la provincia
    expect(CATALOGO.resolver('Mesía', null)).toBeNull();
    expect(CATALOGO.resolver('Mesía', '27')).toBe('27099');
    expect(CATALOGO.resolverEnProvincia('Abegondo', '04')).toBeNull();
  });
});

describe('valor tasado del Ministerio', () => {
  it('lee la hoja de municipios (formato actual, con "n.r")', () => {
    const filas = parseTasadoMunicipios(hoja(muestras.muni));
    expect(filas).toHaveLength(15);
    const coruna = filas.find((f) => f.municipio === 'Coruña (A)')!;
    expect(coruna).toEqual({
      periodo: '2026-04-01', provinciaPista: '15', municipio: 'Coruña (A)',
      ppm2: 2774.8, ppm2Hasta5: 3132.4, ppm2Mas5: 2761.5, tasaciones: 583,
    });
    expect(filas.find((f) => f.municipio === 'Nijar')!.ppm2Hasta5).toBeNull();
  });

  it('lee la hoja antigua (solo total)', () => {
    const filas = parseTasadoMunicipios(hoja(muestras.muniAntigua));
    expect(filas.map((f) => [f.municipio, f.ppm2, f.tasaciones])).toEqual([
      ['Almería', 1477.4, 867], ['Roquetas de Mar', 1484, 773], ['Ejido (El)', 1145.8, 513],
    ]);
    expect(filas[0].periodo).toBe('2005-01-01');
  });

  it('saca el periodo del nombre de la hoja o del título', () => {
    expect(periodoHoja(hoja(muestras.muni))).toBe('2026-04-01');
    expect(periodoHoja({ nombre: 'Hoja1', filas: [[null, 'Tercer trimestre de 2019']] })).toBe('2019-07-01');
  });

  it('lee España y provincias por trimestre, sin las columnas de variación', () => {
    const filas = parseTasadoProvincias([hoja(muestras.prov)]);
    const de = (ambito: string, codigo: string, periodo: string) =>
      filas.find((f) => f.ambito === ambito && f.codigo === codigo && f.periodo === periodo)?.ppm2;
    expect(de('pais', 'ES', '2026-04-01')).toBe(2355);
    expect(de('provincia', '15', '2026-04-01')).toBe(1749.5);
    expect(de('provincia', '15', '2025-04-01')).toBe(1562.8);
    expect(de('provincia', '04', '2023-01-01')).toBe(1156.6);
    expect(de('provincia', '28', '2026-04-01')).toBe(3826.9);
    expect(de('ccaa', '12', '2026-04-01')).toBe(1656.8);
    expect(filas.some((f) => f.nombre.startsWith('Ceuta y Melilla'))).toBe(false);
    expect(filas.filter((f) => f.ambito === 'pais')).toHaveLength(14);
  });

  it('convierte a filas de market_close_series casando municipios', () => {
    const { filas, sinCasar } = filasTasadoMunicipios(parseTasadoMunicipios(hoja(muestras.muni)), CATALOGO);
    expect(filas.find((f) => f.zone_key === '15030')).toMatchObject({
      source: 'mivau_tasado', zone_level: 'municipality', period: '2026-04-01', ppm2: 2774.8, transactions: 583, main_type: null,
    });
    expect(filas.find((f) => f.zone_key === '15002')).toBeTruthy();
    expect(sinCasar).toContain('15 Culleredo');

    const terr = filasTasadoTerritorio(parseTasadoProvincias([hoja(muestras.prov)]));
    expect(terr.every((f) => f.zone_level !== ('ccaa' as never))).toBe(true);
    expect(terr.find((f) => f.zone_level === 'country' && f.period === '2026-04-01')?.ppm2).toBe(2355);
  });
});

describe('compraventas por municipio', () => {
  it('detecta trimestres aunque lleven "(*)"', () => {
    const cols = columnasPeriodo(hoja(muestras.tx).filas)!;
    expect([...cols.columnas.values()].at(-1)).toBe('2026-04-01');
    expect(cols.columnas.get(3)).toBe('2024-01-01');
  });

  it('asigna la provincia de la cabecera, también en comunidades uniprovinciales', () => {
    const filas = parseTransaccionesMunicipios(hoja(muestras.tx), '2025-01-01');
    expect(filas.find((f) => f.municipio === 'Madrid' && f.periodo === '2026-04-01')).toEqual({
      provincia: '28', municipio: 'Madrid', periodo: '2026-04-01', n: 16500,
    });
    expect(filas.filter((f) => f.municipio === 'Ames').map((f) => f.n)).toEqual([79, 59, 109, 84, 85, 79]);
    expect(filas.find((f) => f.municipio === 'Abla')!.provincia).toBe('04');
    expect(filas.some((f) => f.periodo < '2025-01-01')).toBe(false);
  });

  it('casa con el catálogo dentro de la provincia', () => {
    const { filas, sinCasar } = filasTransacciones(parseTransaccionesMunicipios(hoja(muestras.tx)), CATALOGO);
    expect(sinCasar).toEqual([]);
    expect(new Set(filas.map((f) => f.zone_key))).toEqual(new Set(['04001', '15001', '15002', '15030', '28079', '15902']));
    expect(filas.find((f) => f.zone_key === '15030' && f.period === '2026-04-01')?.transactions).toBe(750);
  });
});

describe('IPV del INE', () => {
  it('junta índice y variaciones por comunidad y trimestre', () => {
    const filas = parseIpv(muestras.ipv as SerieIne[]);
    expect(filas.find((f) => f.codigo === '12' && f.tipo === 'general' && f.periodo === '2025-10-01')).toEqual({
      ambito: 'ccaa', codigo: '12', periodo: '2025-10-01', tipo: 'general', indice: 167.197, anualPct: 14.1,
    });
    expect(filas.find((f) => f.codigo === 'ES' && f.tipo === 'segunda_mano' && f.periodo === '2025-07-01')?.anualPct).toBe(13.4);
    expect(filas.find((f) => f.codigo === '13')?.anualPct).toBe(15.2);
  });

  it('repite la fila de la comunidad en cada provincia', () => {
    const filas = filasIpv(parseIpv(muestras.ipv as SerieIne[]));
    const galicia = filas.filter((f) => f.period === '2025-10-01' && f.zone_level === 'province' && f.raw.ccaa === '12');
    expect(galicia.map((f) => f.zone_key).sort()).toEqual(['15', '27', '32', '36']);
    expect(galicia[0]).toMatchObject({ source: 'ine_ipv', index_value: 167.197 });
    expect(galicia[0].raw).toMatchObject({ ambito: 'Galicia', anualPct: 14.1, segundaManoAnualPct: 14.4 });
    expect(filas.find((f) => f.zone_level === 'country' && f.period === '2025-10-01')?.raw.anualPct).toBe(12.9);
  });
});

// ─── Referencia oficial ────────────────────────────────────────────────────

function fila(source: string, zone_level: string, zone_key: string, period: string, extra: Partial<FilaCierre> = {}): FilaCierre {
  return { source, zone_level, zone_key, period, ppm2: null, index_value: null, transactions: null, raw: null, ...extra };
}

const SERIES_CORUNA: FilaCierre[] = [
  fila('mivau_tasado', 'municipality', '15030', '2026-04-01', { ppm2: '2774.8', transactions: 583, raw: { nombre: 'Coruña (A)' } }),
  fila('mivau_tasado', 'municipality', '15030', '2025-04-01', { ppm2: 2500, transactions: 540, raw: { nombre: 'Coruña (A)' } }),
  fila('mivau_tasado', 'province', '15', '2026-04-01', { ppm2: 1749.5 }),
  fila('mivau_tasado', 'province', '15', '2025-04-01', { ppm2: 1562.8 }),
  fila('mivau_tasado', 'country', 'ES', '2026-04-01', { ppm2: 2355 }),
  ...['2026-04-01', '2026-01-01', '2025-10-01', '2025-07-01', '2025-04-01', '2025-01-01', '2024-10-01', '2024-07-01'].map((p, i) =>
    fila('mivau_transacciones', 'municipality', '15030', p, { transactions: i < 4 ? 750 : 700, raw: { nombre: 'Coruña (A)' } })),
  fila('ine_ipv', 'province', '15', '2025-10-01', { index_value: 167.197, raw: { ambito: 'Galicia', anualPct: 14.1, segundaManoAnualPct: 14.4 } }),
  fila('ine_ipv', 'country', 'ES', '2025-10-01', { index_value: 186.75, raw: { ambito: 'España', anualPct: 12.9 } }),
];

describe('referencia oficial', () => {
  it('compara con el tasado del municipio y resume el mercado', () => {
    const ref = buildOfficialReference(SERIES_CORUNA, { municipalityCode: '15030', subjectPpm2: 3000 })!;
    expect(ref.tasado).toEqual({
      level: 'municipality', zoneKey: '15030', label: 'Coruña (A)', period: '2026-04-01', ppm2: 2774.8, tasaciones: 583, yoyPct: 11,
    });
    expect(ref.desviacionPct).toBe(8.1);
    expect(ref.lectura).toBe('en_linea');
    expect(ref.transacciones).toMatchObject({ ultimos12m: 3000, previos12m: 2800, variacionPct: 7.1 });
    expect(ref.ipv).toEqual({ ambito: 'Galicia', period: '2025-10-01', anualPct: 14.1, segundaManoAnualPct: 14.4 });
    expect(ref.puntos.map((p) => [p.indicator, p.sense])).toEqual([
      ['tasado_desviacion', 'positive'],
      ['tasado_tendencia', 'positive'],
      ['compraventas', 'positive'],
      ['ipv', 'positive'],
    ]);
    expect(ref.puntos[0].text).toContain('2775 €/m²');
    expect(ref.puntos[0].text).toContain('2T 2026');
    expect(ref.fuentes).toHaveLength(2);
    expect(explicacionOficial(ref)[0]).toMatch(/^Referencia oficial: /);
  });

  it('marca la estimación muy por encima y pide revisar comparables', () => {
    const ref = buildOfficialReference(SERIES_CORUNA, { municipalityCode: '15030', subjectPpm2: 4500 })!;
    expect(ref.lectura).toBe('por_encima');
    expect(ref.desviacionPct).toBe(62.2);
    expect(ref.puntos[0].sense).toBe('info');
    expect(ref.puntos[0].text).toMatch(/62,2 % por encima.*revisar los comparables/);
  });

  it('cae a la provincia si el municipio no tiene tasado (< 25.000 hab.)', () => {
    const ref = buildOfficialReference(SERIES_CORUNA, { municipalityCode: '15001', subjectPpm2: 1500 })!;
    expect(ref.tasado).toMatchObject({ level: 'province', zoneKey: '15', label: 'provincia de A Coruña', ppm2: 1749.5 });
    expect(ref.lectura).toBe('en_linea');
    expect(ref.transacciones).toBeNull();
  });

  it('descarta un tasado municipal viejo', () => {
    const viejas = [
      fila('mivau_tasado', 'municipality', '15030', '2023-01-01', { ppm2: 2000 }),
      fila('mivau_tasado', 'province', '15', '2026-04-01', { ppm2: 1749.5 }),
    ];
    expect(buildOfficialReference(viejas, { municipalityCode: '15030', subjectPpm2: null })!.tasado?.level).toBe('province');
  });

  it('sin series devuelve null', () => {
    expect(buildOfficialReference([], { municipalityCode: '15030', subjectPpm2: 3000 })).toBeNull();
  });

  it('da un mercado de respaldo con el tasado', () => {
    const z = zoneStatsDesdeReferencia(buildOfficialReference(SERIES_CORUNA, { municipalityCode: '15030', subjectPpm2: null }));
    expect(z).toMatchObject({ zoneLevel: 'municipality', zoneKey: '15030', medianPpm2: 2774.8, n: 583, trend12mPct: 11, source: 'official_series' });
  });
});
