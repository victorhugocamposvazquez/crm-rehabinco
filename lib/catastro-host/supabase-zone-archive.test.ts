import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createZoneStore } from "../catastro/zone-session";
import { createSupabaseZoneArchive } from "./supabase-zone-archive";

type Fila = Record<string, unknown>;

class FakeArchiveQuery {
  private filters: Array<{ col: string; op: "eq" | "neq"; val: unknown }> = [];
  private borrar = false;
  private actualizar: Fila | null = null;

  constructor(
    private readonly filas: Map<string, Fila>,
    private readonly columnas = "*"
  ) {}

  select(columns: string) {
    return new FakeArchiveQuery(this.filas, columns);
  }

  eq(column: string, value: unknown) {
    this.filters.push({ col: column, op: "eq", val: value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ col: column, op: "neq", val: value });
    return this;
  }

  in() {
    return this;
  }

  gt() {
    return this;
  }

  or() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  private coinciden(row: Fila) {
    return this.filters.every((filtro) =>
      filtro.op === "eq" ? row[filtro.col] === filtro.val : row[filtro.col] !== filtro.val
    );
  }

  async maybeSingle() {
    if (this.actualizar) {
      const row = [...this.filas.values()].find((item) => this.coinciden(item));
      if (!row) return { data: null, error: null };
      Object.assign(row, this.actualizar);
      return { data: { id: row.id }, error: null };
    }
    const row = [...this.filas.values()].find((item) => this.coinciden(item));
    return { data: row ?? null, error: null };
  }

  then(onfulfilled?: (value: { data: Fila[]; error: null }) => unknown) {
    if (this.borrar) {
      for (const [clave, row] of [...this.filas.entries()]) {
        if (this.coinciden(row)) this.filas.delete(clave);
      }
    }
    return Promise.resolve({ data: [...this.filas.values()].filter((row) => this.coinciden(row)), error: null }).then(
      onfulfilled
    );
  }
}

function clienteFalso(filas = new Map<string, Fila>()) {
  return {
    filas,
    from() {
      return {
        select: (columns: string) => new FakeArchiveQuery(filas, columns),
        delete: () => {
          const q = new FakeArchiveQuery(filas);
          q["borrar"] = true;
          return q;
        },
        update: (values: Fila) => {
          const q = new FakeArchiveQuery(filas);
          q["actualizar"] = values;
          return q;
        },
        upsert: async (values: Fila) => {
          filas.set(String(values.id), { ...values });
          return { error: null };
        },
      };
    },
  };
}

function sesion(id: string, hechas: number, steps: number, updatedAt: number) {
  const store = createZoneStore({ idFactory: () => id });
  const creada = store.create({
    userId: "user-1",
    claveZona: "MADRID|ALCOBENDAS|28703|0",
    criterios: {
      provincia: "MADRID",
      municipio: "ALCOBENDAS",
      postalCode: "28703",
      horizontalDivision: "NO",
      streetOffset: 0,
    },
    provinciaOficial: "Madrid",
    municipioOficial: "Alcobendas",
    calles: [
      { code: "1", sigla: "CL", name: "A" },
      { code: "2", sigla: "CL", name: "B" },
    ],
    streetsTotal: 48,
    streetOffset: 0,
  });
  assert.equal(creada.ok, true);
  if (!creada.ok) throw new Error("sesión");
  for (let i = 0; i < hechas; i += 1) creada.session.calles[i].status = "done";
  creada.session.steps = steps;
  creada.session.updatedAt = updatedAt;
  return creada.session;
}

describe("Archivo Supabase de zona", () => {
  it("no deja que un prepare a 0 borre 8 calles ya persistidas", async () => {
    const db = clienteFalso();
    const archive = createSupabaseZoneArchive(db);
    await archive.put(sesion("zona-1", 1, 2, 2_000));
    await archive.put(sesion("zona-nueva", 0, 0, 9_000));
    const guardada = await archive.findByKey("user-1", "MADRID|ALCOBENDAS|28703|0");
    assert.equal(guardada?.id, "zona-1");
    assert.equal(guardada?.calles.filter((calle) => calle.status === "done").length, 1);
    assert.equal(db.filas.has("zona-nueva"), false);
  });

  it("sí guarda un paso con más calles hechas", async () => {
    const db = clienteFalso();
    const archive = createSupabaseZoneArchive(db);
    await archive.put(sesion("zona-1", 1, 1, 1_000));
    await archive.put(sesion("zona-1", 2, 2, 2_000));
    const guardada = await archive.get("zona-1", "user-1");
    assert.equal(guardada?.calles.filter((calle) => calle.status === "done").length, 2);
  });
});
