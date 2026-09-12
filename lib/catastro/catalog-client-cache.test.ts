import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVISO_FALLBACK_CATALOGO,
  CATALOG_CLIENT_MAX_STREET_CATALOGS,
  CATALOG_CLIENT_VERSION,
  cargarCatalogo,
  claveCacheCalles,
  claveCacheMunicipios,
  claveCacheProvincias,
  crearSelectorCatalogo,
  crearStoreIndexedDb,
  crearStoreMemoria,
  esEntradaCatalogo,
  podarCatalogos,
  type CatalogStore,
  type EstadoCatalogo,
  type MetricaCatalogo,
} from "./catalog-client-cache";

type Calle = { code: string; sigla: string; name: string };

const FUENCARRAL: Calle = { code: "2365", sigla: "CL", name: "FUENCARRAL" };
const GUAYANA: Calle = { code: "57", sigla: "CL", name: "GUAYANA-MOJONERA" };
const HORA = 60 * 60 * 1000;

function esCalle(item: unknown): item is Calle {
  const r = item as Record<string, unknown> | null;
  return Boolean(
    r && typeof r.code === "string" && typeof r.sigla === "string" && typeof r.name === "string"
  );
}

function reloj(inicial = 1_000_000) {
  let ahora = inicial;
  return {
    now: () => ahora,
    avanzar(ms: number) {
      ahora += ms;
    },
  };
}

function fetcherDe(items: Calle[], registro?: { llamadas: number }) {
  return async () => {
    if (registro) registro.llamadas += 1;
    return items;
  };
}

function fetcherQueFalla(registro?: { llamadas: number }) {
  return async () => {
    if (registro) registro.llamadas += 1;
    throw new Error("API caída");
  };
}

function recolector() {
  const metricas: MetricaCatalogo[] = [];
  const estados: EstadoCatalogo<Calle>[] = [];
  return {
    metricas,
    estados,
    onMetric: (m: MetricaCatalogo) => {
      metricas.push(m);
    },
    onEstado: (e: EstadoCatalogo<Calle>) => {
      estados.push(e);
    },
    nombres() {
      return metricas.map((m) => m.name);
    },
  };
}

describe("cache cliente del catálogo", () => {
  it("1. primera carga sin cache descarga y guarda", async () => {
    const store = crearStoreMemoria();
    const r = recolector();
    const llamadas = { llamadas: 0 };
    const key = claveCacheCalles("28", "79");
    const final = await cargarCatalogo(
      { key, store, fetcher: fetcherDe([FUENCARRAL], llamadas), validarItem: esCalle, onMetric: r.onMetric },
      r.onEstado
    );
    assert.equal(llamadas.llamadas, 1);
    assert.equal(final.source, "network");
    assert.deepEqual(final.items, [FUENCARRAL]);
    assert.equal(r.estados.length, 1);
    assert.ok(r.nombres().includes("catalogCacheMiss"));
    assert.ok(r.nombres().includes("catalogLoadMs"));
    const guardado = (await store.get(key)) as Record<string, unknown>;
    assert.equal(guardado.version, CATALOG_CLIENT_VERSION);
    assert.equal(typeof guardado.fetchedAt, "number");
    assert.equal(typeof guardado.expiresAt, "number");
  });

  it("2 y 3. lectura de cache válida no toca la red", async () => {
    const store = crearStoreMemoria();
    const c = reloj();
    const key = claveCacheCalles("28", "79");
    await cargarCatalogo(
      { key, store, fetcher: fetcherDe([FUENCARRAL]), validarItem: esCalle, now: c.now, onMetric: () => {} },
      () => {}
    );
    c.avanzar(HORA);
    const r = recolector();
    const llamadas = { llamadas: 0 };
    const final = await cargarCatalogo(
      { key, store, fetcher: fetcherQueFalla(llamadas), validarItem: esCalle, now: c.now, onMetric: r.onMetric },
      r.onEstado
    );
    assert.equal(llamadas.llamadas, 0);
    assert.equal(final.source, "cache");
    assert.equal(final.stale, false);
    assert.equal(final.revalidating, false);
    assert.ok(r.metricas.some((m) => m.name === "catalogCacheHit" && m.reason === "fresh"));
  });

  it("4 y 5. cache caducada se muestra al instante y se revalida detrás", async () => {
    const store = crearStoreMemoria();
    const c = reloj();
    const key = claveCacheCalles("28", "79");
    await cargarCatalogo(
      { key, store, fetcher: fetcherDe([FUENCARRAL]), validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: () => {} },
      () => {}
    );
    c.avanzar(2 * HORA);
    const r = recolector();
    const nuevas = [FUENCARRAL, GUAYANA];
    const final = await cargarCatalogo(
      { key, store, fetcher: fetcherDe(nuevas), validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: r.onMetric },
      r.onEstado
    );
    assert.equal(r.estados.length, 2);
    assert.equal(r.estados[0].source, "cache");
    assert.equal(r.estados[0].stale, true);
    assert.equal(r.estados[0].revalidating, true);
    assert.deepEqual(r.estados[0].items, [FUENCARRAL]);
    assert.equal(final.source, "network");
    assert.deepEqual(final.items, nuevas);
    assert.ok(r.nombres().includes("catalogRevalidated"));
    const guardado = (await store.get(key)) as { expiresAt: number };
    assert.equal(guardado.expiresAt, c.now() + HORA);
  });

  it("6 y 7. error de revalidación mantiene datos y avisa", async () => {
    const store = crearStoreMemoria();
    const c = reloj();
    const key = claveCacheCalles("28", "79");
    await cargarCatalogo(
      { key, store, fetcher: fetcherDe([FUENCARRAL]), validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: () => {} },
      () => {}
    );
    c.avanzar(5 * HORA);
    const r = recolector();
    const final = await cargarCatalogo(
      { key, store, fetcher: fetcherQueFalla(), validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: r.onMetric },
      r.onEstado
    );
    assert.equal(final.fallback, true);
    assert.deepEqual(final.items, [FUENCARRAL]);
    assert.equal(final.aviso, AVISO_FALLBACK_CATALOGO);
    assert.equal(final.revalidating, false);
    assert.ok(r.nombres().includes("catalogFallback"));
  });

  it("7. sin cache y API caída, lanza (no hay fallback posible)", async () => {
    const store = crearStoreMemoria();
    await assert.rejects(
      cargarCatalogo(
        { key: claveCacheCalles("28", "79"), store, fetcher: fetcherQueFalla(), validarItem: esCalle, onMetric: () => {} },
        () => {}
      ),
      /API caída/
    );
  });

  it("8 y 12. cache corrupta o de otra versión se descarta y se vuelve a descargar", async () => {
    const store = crearStoreMemoria();
    const key = claveCacheCalles("28", "79");
    await store.set(key, { version: "0", fetchedAt: 1, expiresAt: Number.MAX_SAFE_INTEGER, items: [FUENCARRAL] });
    const r = recolector();
    const llamadas = { llamadas: 0 };
    const final = await cargarCatalogo(
      { key, store, fetcher: fetcherDe([GUAYANA], llamadas), validarItem: esCalle, onMetric: r.onMetric },
      r.onEstado
    );
    assert.equal(llamadas.llamadas, 1);
    assert.deepEqual(final.items, [GUAYANA]);
    assert.ok(r.metricas.some((m) => m.name === "catalogCacheMiss" && m.reason === "incompatible"));

    await store.set(key, { version: CATALOG_CLIENT_VERSION, fetchedAt: 1, expiresAt: Number.MAX_SAFE_INTEGER, items: [{ code: 1 }] });
    assert.equal(esEntradaCatalogo(await store.get(key), CATALOG_CLIENT_VERSION, esCalle), false);
    await store.set(key, "basura");
    const r2 = recolector();
    await cargarCatalogo(
      { key, store, fetcher: fetcherDe([GUAYANA]), validarItem: esCalle, onMetric: r2.onMetric },
      r2.onEstado
    );
    assert.ok(r2.metricas.some((m) => m.name === "catalogCacheMiss" && m.reason === "incompatible"));
  });

  it("9 y 10. las claves separan provincia y municipio", async () => {
    const store = crearStoreMemoria();
    const madrid = claveCacheCalles("28", "79");
    const godelleta = claveCacheCalles("46", "138");
    assert.notEqual(madrid, godelleta);
    assert.notEqual(claveCacheMunicipios("28"), claveCacheMunicipios("46"));
    assert.equal(claveCacheProvincias(), "provinces");
    await cargarCatalogo({ key: madrid, store, fetcher: fetcherDe([FUENCARRAL]), validarItem: esCalle, onMetric: () => {} }, () => {});
    await cargarCatalogo({ key: godelleta, store, fetcher: fetcherDe([GUAYANA]), validarItem: esCalle, onMetric: () => {} }, () => {});
    const a = (await store.get(madrid)) as { items: Calle[] };
    const b = (await store.get(godelleta)) as { items: Calle[] };
    assert.deepEqual(a.items, [FUENCARRAL]);
    assert.deepEqual(b.items, [GUAYANA]);
  });

  it("11. una revalidación antigua no pisa el catálogo activo", async () => {
    const store = crearStoreMemoria();
    const c = reloj();
    const madrid = claveCacheCalles("28", "79");
    const valencia = claveCacheCalles("46", "138");
    await cargarCatalogo({ key: madrid, store, fetcher: fetcherDe([FUENCARRAL]), validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: () => {} }, () => {});
    c.avanzar(3 * HORA);

    const liberador: { fn: (() => void) | null } = { fn: null };
    const fetcherLento = () =>
      new Promise<Calle[]>((resolve) => {
        liberador.fn = () => resolve([FUENCARRAL, { code: "9", sigla: "AV", name: "NUEVA" }]);
      });

    const selector = crearSelectorCatalogo<Calle>();
    const recibidos: Array<{ key: string; items: Calle[] }> = [];
    const pMadrid = selector.seleccionar(
      { key: madrid, store, fetcher: fetcherLento, validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: () => {} },
      (estado) => recibidos.push({ key: madrid, items: estado.items })
    );
    await new Promise((r) => setTimeout(r, 0));
    const pValencia = selector.seleccionar(
      { key: valencia, store, fetcher: fetcherDe([GUAYANA]), validarItem: esCalle, now: c.now, ttlMs: HORA, onMetric: () => {} },
      (estado) => recibidos.push({ key: valencia, items: estado.items })
    );
    const finalValencia = await pValencia;
    liberador.fn?.();
    const finalMadrid = await pMadrid;

    assert.equal(finalMadrid, null);
    assert.deepEqual(finalValencia?.items, [GUAYANA]);
    assert.equal(selector.claveActual(), valencia);
    const ultimo = recibidos[recibidos.length - 1];
    assert.equal(ultimo.key, valencia);
    assert.equal(recibidos.some((r) => r.key === madrid && r.items.length === 2), false);
  });

  it("13 y 14. cambiar de provincia o municipio no borra otras caches", async () => {
    const store = crearStoreMemoria();
    const madrid = claveCacheCalles("28", "79");
    const godelleta = claveCacheCalles("46", "138");
    const selector = crearSelectorCatalogo<Calle>();
    await selector.seleccionar({ key: madrid, store, fetcher: fetcherDe([FUENCARRAL]), validarItem: esCalle, onMetric: () => {} }, () => {});
    await selector.seleccionar({ key: godelleta, store, fetcher: fetcherDe([GUAYANA]), validarItem: esCalle, onMetric: () => {} }, () => {});
    const llamadas = { llamadas: 0 };
    const vuelta = await selector.seleccionar(
      { key: madrid, store, fetcher: fetcherQueFalla(llamadas), validarItem: esCalle, onMetric: () => {} },
      () => {}
    );
    assert.equal(llamadas.llamadas, 0);
    assert.deepEqual(vuelta?.items, [FUENCARRAL]);
    assert.ok(await store.get(godelleta));
  });

  it("15. dos cargas simultáneas de la misma clave descargan una vez", async () => {
    const store = crearStoreMemoria();
    const key = claveCacheCalles("28", "79");
    const llamadas = { llamadas: 0 };
    const inflight = new Map<string, Promise<unknown[]>>();
    const fetcher = async () => {
      llamadas.llamadas += 1;
      await new Promise((r) => setTimeout(r, 5));
      return [FUENCARRAL];
    };
    const [a, b] = await Promise.all([
      cargarCatalogo({ key, store, fetcher, validarItem: esCalle, inflight, onMetric: () => {} }, () => {}),
      cargarCatalogo({ key, store, fetcher, validarItem: esCalle, inflight, onMetric: () => {} }, () => {}),
    ]);
    assert.equal(llamadas.llamadas, 1);
    assert.deepEqual(a.items, b.items);
  });

  it("no guarda callejeros sin límite: poda los más antiguos", async () => {
    const store = crearStoreMemoria();
    for (let i = 0; i < CATALOG_CLIENT_MAX_STREET_CATALOGS + 3; i += 1) {
      await store.set(claveCacheCalles("28", String(i)), {
        version: CATALOG_CLIENT_VERSION,
        fetchedAt: i,
        expiresAt: i + HORA,
        items: [],
      });
    }
    await store.set(claveCacheMunicipios("28"), { version: CATALOG_CLIENT_VERSION, fetchedAt: 0, expiresAt: HORA, items: [] });
    const borradas = await podarCatalogos(store, "streets:", CATALOG_CLIENT_MAX_STREET_CATALOGS);
    assert.deepEqual(borradas.sort(), [claveCacheCalles("28", "0"), claveCacheCalles("28", "1"), claveCacheCalles("28", "2")].sort());
    assert.ok(await store.get(claveCacheMunicipios("28")));
    assert.equal((await store.keys()).filter((k) => k.startsWith("streets:")).length, CATALOG_CLIENT_MAX_STREET_CATALOGS);
  });

  it("sin IndexedDB degrada a memoria y sigue funcionando", async () => {
    const store: CatalogStore = crearStoreIndexedDb();
    await store.set("x", { a: 1 });
    assert.deepEqual(await store.get("x"), { a: 1 });
    assert.deepEqual(await store.keys(), ["x"]);
    await store.delete("x");
    assert.equal(await store.get("x"), undefined);
  });

  it("no emite tras abortar", async () => {
    const store = crearStoreMemoria();
    const controller = new AbortController();
    const r = recolector();
    const fetcher = async () => {
      controller.abort();
      return [FUENCARRAL];
    };
    await cargarCatalogo(
      { key: claveCacheCalles("28", "79"), store, fetcher, validarItem: esCalle, signal: controller.signal, onMetric: () => {} },
      r.onEstado
    );
    assert.equal(r.estados.length, 0);
  });
});
