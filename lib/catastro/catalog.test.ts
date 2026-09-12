import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCatalogCache,
  encontrarPorNombre,
  parsearCalles,
  parsearMunicipios,
  parsearProvincias,
  responderCalles,
  responderMunicipios,
  responderProvincias,
  validarParametroCatalogo,
} from "./catalog";
import { createCatastroClient, type CatastroClient } from "./client";
import { CATALOG_MAX_PARAM_LENGTH } from "./constants";
import { CatastroHttpError } from "./http";
import { responderBusquedaComercial } from "./search-commercial";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";
const usuario = { id: "fase12-test" };

const RAW_PROVINCIAS = {
  consulta_provincieroResult: {
    control: { cuprov: 2 },
    provinciero: {
      prov: [
        { cpine: "28", np: "MADRID" },
        { cpine: "46", np: "VALENCIA" },
      ],
    },
  },
};

const RAW_MUNICIPIOS = {
  consulta_municipieroResult: {
    municipiero: {
      muni: [
        { locat: { cd: "28", cmc: "79" }, nm: "MADRID" },
        { locat: { cd: "28", cmc: "74" }, nm: "HUMANES DE MADRID" },
      ],
    },
  },
};

const RAW_CALLES = {
  consulta_callejeroResult: {
    callejero: {
      calle: [
        { dir: { cv: "2365", tv: "CL", nv: "FUENCARRAL" } },
        { dir: { cv: "2366", tv: "CM", nv: "FUENCARRAL" } },
        { dir: { cv: "57", tv: "CL", nv: "GUAYANA-MOJONERA" } },
      ],
    },
  },
};

const RAW_VACIO = {
  consulta_municipieroResult: {
    control: { cuerr: 1 },
    lerr: { err: [{ cod: "33", des: "No hay municipios" }] },
  },
};

function requestDe(path: string, query = "") {
  const qs = query ? `?${query}` : "";
  return new Request(`http://localhost${path}${qs}`);
}

async function leer(response: Response) {
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function clienteMock(opts?: {
  provincias?: unknown;
  municipios?: unknown;
  calles?: unknown;
  onMunicipios?: (provincia: string, municipio?: string) => void;
  onCallejero?: (params: { provincia: string; municipio: string; nomVia?: string }) => void;
}): CatastroClient & { counts: { provincias: number; municipios: number; calles: number } } {
  const counts = { provincias: 0, municipios: 0, calles: 0 };
  return {
    counts,
    obtenerProvincias: async () => {
      counts.provincias += 1;
      return (opts?.provincias ?? RAW_PROVINCIAS) as never;
    },
    obtenerMunicipios: async (provincia: string, municipio?: string) => {
      counts.municipios += 1;
      opts?.onMunicipios?.(provincia, municipio);
      return (opts?.municipios ?? RAW_MUNICIPIOS) as never;
    },
    obtenerCallejero: async (params) => {
      counts.calles += 1;
      opts?.onCallejero?.(params);
      return (opts?.calles ?? RAW_CALLES) as never;
    },
  } as CatastroClient & { counts: { provincias: number; municipios: number; calles: number } };
}

describe("parseo oficial del catálogo", () => {
  it("1. transforma provincias oficiales sin inventar códigos", () => {
    const provincias = parsearProvincias(RAW_PROVINCIAS);
    assert.deepEqual(provincias, [
      { code: "28", name: "MADRID" },
      { code: "46", name: "VALENCIA" },
    ]);
  });

  it("2. transforma municipios oficiales (locat.cmc + nm)", () => {
    const municipios = parsearMunicipios(RAW_MUNICIPIOS);
    assert.deepEqual(
      municipios.map((item) => item.name),
      ["HUMANES DE MADRID", "MADRID"]
    );
    assert.equal(encontrarPorNombre(municipios, "Madrid")?.code, "79");
    assert.equal(encontrarPorNombre(municipios, "Humanes"), null);
  });

  it("3. transforma calles oficiales (cv + tv + nv)", () => {
    const calles = parsearCalles(RAW_CALLES);
    const fuencarral = calles.find((item) => item.sigla === "CL" && item.name === "FUENCARRAL");
    assert.deepEqual(fuencarral, { code: "2365", sigla: "CL", name: "FUENCARRAL" });
    assert.equal(calles.some((item) => item.sigla === "CM" && item.name === "FUENCARRAL"), true);
  });

  it("9. no incluye XML ni el raw de Catastro", () => {
    const texto = JSON.stringify({
      provinces: parsearProvincias(RAW_PROVINCIAS),
      items: parsearCalles(RAW_CALLES),
    });
    assert.equal(texto.includes("consulta_"), false);
    assert.equal(texto.includes("<"), false);
    assert.equal(texto.includes("lerr"), false);
  });
});

describe("GET /api/catastro/provinces", () => {
  it("exige sesión", async () => {
    const res = await responderProvincias(requestDe("/api/catastro/provinces"), null);
    assert.equal(res.status, 401);
  });

  it("devuelve el listado oficial", async () => {
    const client = clienteMock();
    const { status, body } = await leer(
      await responderProvincias(requestDe("/api/catastro/provinces"), usuario, {
        client,
        cache: createCatalogCache(),
      })
    );
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    const provinces = body.provinces as Array<{ code: string; name: string }>;
    assert.equal(provinces.some((item) => item.code === "28" && item.name === "MADRID"), true);
    assert.equal(JSON.stringify(body).includes("consulta_provinciero"), false);
  });

  it("4. rechaza parámetros arbitrarios", async () => {
    const { status } = await leer(
      await responderProvincias(requestDe("/api/catastro/provinces", "foo=1"), usuario, {
        client: clienteMock(),
        cache: createCatalogCache(),
      })
    );
    assert.equal(status, 400);
  });
});

describe("GET /api/catastro/municipalities", () => {
  it("4. province es obligatorio", async () => {
    const { status, body } = await leer(
      await responderMunicipios(requestDe("/api/catastro/municipalities"), usuario, {
        client: clienteMock(),
        cache: createCatalogCache(),
      })
    );
    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  it("5. provincia inválida no consulta municipios", async () => {
    const client = clienteMock();
    const { status } = await leer(
      await responderMunicipios(
        requestDe("/api/catastro/municipalities", "province=ATLANTIDA"),
        usuario,
        { client, cache: createCatalogCache() }
      )
    );
    assert.equal(status, 400);
    assert.equal(client.counts.municipios, 0);
  });

  it("no aproxima Humanes a Humanes de Madrid", async () => {
    const client = clienteMock();
    const { status, body } = await leer(
      await responderMunicipios(
        requestDe("/api/catastro/municipalities", "province=Madrid"),
        usuario,
        { client, cache: createCatalogCache() }
      )
    );
    assert.equal(status, 200);
    const items = body.items as Array<{ name: string }>;
    assert.equal(items.some((item) => item.name === "HUMANES DE MADRID"), true);
    assert.equal(items.some((item) => item.name === "HUMANES"), false);
  });

  it("8. lista vacía es 200", async () => {
    const client = clienteMock({ municipios: RAW_VACIO });
    const { status, body } = await leer(
      await responderMunicipios(
        requestDe("/api/catastro/municipalities", "province=VALENCIA"),
        usuario,
        { client, cache: createCatalogCache() }
      )
    );
    assert.equal(status, 200);
    assert.deepEqual(body.items, []);
  });

  it("pide el catálogo completo de la provincia, sin filtro fuzzy", async () => {
    let visto: { provincia: string; municipio?: string } | null = null;
    const client = clienteMock({
      onMunicipios: (provincia, municipio) => {
        visto = { provincia, municipio };
      },
    });
    await responderMunicipios(
      requestDe("/api/catastro/municipalities", "province=Madrid"),
      usuario,
      { client, cache: createCatalogCache() }
    );
    assert.deepEqual(visto, { provincia: "MADRID", municipio: undefined });
  });
});

describe("GET /api/catastro/streets", () => {
  it("4. exige provincia y municipio", async () => {
    const faltaMun = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Madrid"),
        usuario,
        { client: clienteMock(), cache: createCatalogCache() }
      )
    );
    assert.equal(faltaMun.status, 400);
  });

  it("6. municipio inválido no consulta el callejero", async () => {
    const client = clienteMock();
    const { status } = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Madrid&municipality=Humanes"),
        usuario,
        { client, cache: createCatalogCache() }
      )
    );
    assert.equal(status, 400);
    assert.equal(client.counts.calles, 0);
  });

  it("devuelve code + sigla + name oficiales", async () => {
    const { status, body } = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Madrid&municipality=Madrid"),
        usuario,
        { client: clienteMock(), cache: createCatalogCache() }
      )
    );
    assert.equal(status, 200);
    const items = body.items as Array<{ code: string; sigla: string; name: string }>;
    assert.deepEqual(
      items.find((item) => item.sigla === "CL" && item.name === "FUENCARRAL"),
      { code: "2365", sigla: "CL", name: "FUENCARRAL" }
    );
    assert.equal(JSON.stringify(body).includes("consulta_callejero"), false);
  });

  it("no envía NomVia a Catastro", async () => {
    let visto: { nomVia?: string } | null = null;
    const client = clienteMock({
      onCallejero: (params) => {
        visto = params;
      },
    });
    await responderCalles(
      requestDe("/api/catastro/streets", "province=Madrid&municipality=Madrid"),
      usuario,
      { client, cache: createCatalogCache() }
    );
    assert.equal(visto?.nomVia, undefined);
  });

  it("8. callejero vacío es 200", async () => {
    const { status, body } = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Madrid&municipality=Madrid"),
        usuario,
        {
          client: clienteMock({
            calles: { consulta_callejeroResult: { control: { cuerr: 1 }, lerr: { err: [] } } },
          }),
          cache: createCatalogCache(),
        }
      )
    );
    assert.equal(status, 200);
    assert.deepEqual(body.items, []);
  });
});

describe("cache y límites del catálogo", () => {
  it("7. la segunda petición reutiliza cache", async () => {
    const client = clienteMock();
    const cache = createCatalogCache();
    await responderMunicipios(
      requestDe("/api/catastro/municipalities", "province=Madrid"),
      usuario,
      { client, cache }
    );
    await responderMunicipios(
      requestDe("/api/catastro/municipalities", "province=madrid"),
      usuario,
      { client, cache }
    );
    assert.equal(client.counts.provincias, 1);
    assert.equal(client.counts.municipios, 1);
    assert.equal(cache.stats().hits >= 1, true);
  });

  it("11. rechaza parámetros excesivos o peligrosos", () => {
    assert.equal(validarParametroCatalogo("A".repeat(CATALOG_MAX_PARAM_LENGTH + 1), "province").ok, false);
    assert.equal(validarParametroCatalogo("<script>", "province").ok, false);
    assert.equal(validarParametroCatalogo("Madrid", "province").ok, true);
  });

  it("11. rechaza query desconocida en calles", async () => {
    const { status } = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Madrid&municipality=Madrid&nomVia=fuenc"),
        usuario,
        { client: clienteMock(), cache: createCatalogCache() }
      )
    );
    assert.equal(status, 400);
  });

  it("propaga 502 si Catastro falla", async () => {
    const client = clienteMock();
    client.obtenerProvincias = async () => {
      throw new CatastroHttpError("timeout", 503);
    };
    const { status, body } = await leer(
      await responderProvincias(requestDe("/api/catastro/provinces"), usuario, {
        client,
        cache: createCatalogCache(),
      })
    );
    assert.equal(status, 502);
    assert.equal(String(body.error).includes("<"), false);
  });
});

describe("GET catálogo contra Catastro", { skip: skipLive }, () => {
  const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });
  const cache = createCatalogCache();

  it("Madrid / Madrid / Fuencarral tiene código y sigla oficiales", async () => {
    const provincias = await leer(
      await responderProvincias(requestDe("/api/catastro/provinces"), usuario, { client, cache })
    );
    const madrid = (provincias.body.provinces as Array<{ code: string; name: string }>).find(
      (item) => item.name === "MADRID"
    );
    assert.equal(madrid?.code, "28");

    const municipios = await leer(
      await responderMunicipios(
        requestDe("/api/catastro/municipalities", "province=Madrid"),
        usuario,
        { client, cache }
      )
    );
    const mun = (municipios.body.items as Array<{ code: string; name: string }>).find(
      (item) => item.name === "MADRID"
    );
    assert.ok(mun?.code);

    const calles = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Madrid&municipality=Madrid"),
        usuario,
        { client, cache }
      )
    );
    const via = (calles.body.items as Array<{ code: string; sigla: string; name: string }>).find(
      (item) => item.sigla === "CL" && item.name === "FUENCARRAL"
    );
    assert.equal(via?.code, "2365");
    assert.equal(via?.sigla, "CL");

    const busqueda = await responderBusquedaComercial(
      requestDe(
        "/api/catastro/search",
        "provincia=Madrid&municipio=Madrid&sigla=CL&via=FUENCARRAL&numero=50&horizontalDivision=ALL"
      ),
      usuario,
      client
    );
    const cuerpo = (await busqueda.json()) as {
      results: Array<{ fincaReference: string }>;
    };
    assert.equal(cuerpo.results[0]?.fincaReference, "0751301VK4705B");
  });

  it("Valencia / Godelleta / GUAYANA-MOJONERA 3 NO", async () => {
    const calles = await leer(
      await responderCalles(
        requestDe("/api/catastro/streets", "province=Valencia&municipality=Godelleta"),
        usuario,
        { client, cache }
      )
    );
    const via = (calles.body.items as Array<{ code: string; sigla: string; name: string }>).find(
      (item) => item.name === "GUAYANA-MOJONERA"
    );
    assert.equal(via?.sigla, "CL");
    assert.equal(via?.code, "57");

    const busqueda = await responderBusquedaComercial(
      requestDe(
        "/api/catastro/search",
        "provincia=Valencia&municipio=Godelleta&sigla=CL&via=GUAYANA-MOJONERA&numero=3&horizontalDivision=NO"
      ),
      usuario,
      client
    );
    const cuerpo = (await busqueda.json()) as {
      results: Array<{ fincaReference: string }>;
    };
    assert.equal(cuerpo.results[0]?.fincaReference, "2749704YJ0624N");
  });
});
