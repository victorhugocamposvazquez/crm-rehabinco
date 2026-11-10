import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idsRezagadosParaRetirar } from "./barrido-retirados";

describe("idsRezagadosParaRetirar", () => {
  const iniciada = "2026-11-05T04:30:00.000Z";

  it("marca no vistos con visto_en anterior al inicio", () => {
    const ids = idsRezagadosParaRetirar(
      [
        {
          id: "a",
          externo_id: "11111",
          fase: "novedad",
          anunciante: "particular",
          visto_en: "2026-11-04T10:00:00.000Z",
        },
        {
          id: "b",
          externo_id: "22222",
          fase: "novedad",
          anunciante: "particular",
          visto_en: "2026-11-04T10:00:00.000Z",
        },
      ],
      new Set(["11111"]),
      iniciada
    );
    assert.deepEqual(ids, ["b"]);
  });

  it("no marca si visto_en es de esta pasada", () => {
    const ids = idsRezagadosParaRetirar(
      [
        {
          id: "c",
          externo_id: "33333",
          fase: "novedad",
          anunciante: "particular",
          visto_en: "2026-11-05T05:00:00.000Z",
        },
      ],
      new Set(),
      iniciada
    );
    assert.deepEqual(ids, []);
  });

  it("filtro solo particulares en novedad", () => {
    const ids = idsRezagadosParaRetirar(
      [
        {
          id: "d",
          externo_id: "44444",
          fase: "contacto",
          anunciante: "particular",
          visto_en: "2026-11-01T00:00:00.000Z",
        },
        {
          id: "e",
          externo_id: "55555",
          fase: "novedad",
          anunciante: "empresa",
          visto_en: "2026-11-01T00:00:00.000Z",
        },
        {
          id: "f",
          externo_id: "66666",
          fase: "novedad",
          anunciante: "particular",
          visto_en: "2026-11-01T00:00:00.000Z",
        },
      ],
      new Set(),
      iniciada,
      { soloParticularesNovedad: true }
    );
    assert.deepEqual(ids, ["f"]);
  });
});
