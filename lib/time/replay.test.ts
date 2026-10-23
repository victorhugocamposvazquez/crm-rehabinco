import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatoRelojCorto, punchesActivos, replayDia, siguienteEstadoValido } from "./replay";
import type { Punch } from "./types";

function p(partial: Partial<Punch> & { type: Punch["type"]; at: string }): Punch {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    user_id: "u1",
    mode: "office",
    source: "test",
    ...partial,
  };
}

describe("replayDia", () => {
  it("IN → working y acumula hasta now", () => {
    const r = replayDia(
      [p({ type: "in", at: "2026-10-23T08:00:00.000Z" })],
      "2026-10-23T10:00:00.000Z"
    );
    assert.equal(r.phase, "working");
    assert.equal(r.effectiveMs, 2 * 60 * 60 * 1000);
    assert.equal(formatoRelojCorto(r.effectiveMs), "02:00");
  });

  it("cuenta pausas aparte del tiempo efectivo", () => {
    const r = replayDia(
      [
        p({ type: "in", at: "2026-10-23T08:00:00.000Z" }),
        p({ type: "pause_start", at: "2026-10-23T12:00:00.000Z" }),
        p({ type: "pause_end", at: "2026-10-23T13:00:00.000Z" }),
        p({ type: "out", at: "2026-10-23T17:00:00.000Z" }),
      ],
      "2026-10-23T18:00:00.000Z"
    );
    assert.equal(r.phase, "out");
    assert.equal(r.effectiveMs, 8 * 60 * 60 * 1000);
    assert.equal(r.pauseMs, 60 * 60 * 1000);
    assert.equal(r.missingOut, false);
  });

  it("ignora punches supersedidos", () => {
    const bad = p({ id: "a", type: "out", at: "2026-10-23T12:00:00.000Z", superseded_by: "b" });
    const good = p({ id: "b", type: "out", at: "2026-10-23T18:00:00.000Z" });
    const r = replayDia(
      [p({ type: "in", at: "2026-10-23T08:00:00.000Z" }), bad, good],
      "2026-10-23T19:00:00.000Z"
    );
    assert.equal(punchesActivos([bad, good]).map((x) => x.id).join(), "b");
    assert.equal(r.effectiveMs, 10 * 60 * 60 * 1000);
  });

  it("valida secuencia", () => {
    assert.equal(siguienteEstadoValido("out", "in"), true);
    assert.equal(siguienteEstadoValido("working", "in"), false);
    assert.equal(siguienteEstadoValido("paused", "out"), true);
  });
});
