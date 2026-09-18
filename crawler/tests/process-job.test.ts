import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../src/adapters/habitaclia/index.js";
import type { CrawlJob } from "../src/queue/claim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTADO = readFileSync(
  path.join(__dirname, "fixtures/habitaclia/undici-1789637963665.html"),
  "utf8"
);

const fetchPagina = vi.fn();
const guardarCrudo = vi.fn();
const finalizarJob = vi.fn();

vi.mock("../src/transport/http.js", () => ({
  fetchPagina: (...args: unknown[]) => fetchPagina(...args),
  fetchConRespaldo: (...args: unknown[]) => fetchPagina(...args),
  esBloqueo: () => false,
  reintentoPermitido: () => false,
}));

vi.mock("../src/transport/circuit-breaker.js", () => ({
  portalBloqueado: async () => false,
  limpiarBloqueoPortal: async () => {},
  pausarPortalSinProxy: async () => new Date().toISOString(),
  registrarBloqueoPortal: async () => {},
}));

vi.mock("../src/transport/rate-limit.js", () => ({
  esperaEntrePeticiones: () => 0,
  ritmoEfectivo: (r: { minMs: number; maxMs: number }) => r,
  sleep: async () => {},
}));

vi.mock("../src/pipeline/raw-storage.js", () => ({
  guardarCrudo: (...args: unknown[]) => guardarCrudo(...args),
  rutaCruda: () => "habitaclia/test/raw.html",
}));

vi.mock("../src/queue/claim.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/queue/claim.js")>();
  return {
    ...orig,
    finalizarJob: (...args: unknown[]) => finalizarJob(...args),
  };
});

function jobListado(): CrawlJob {
  return {
    id: "job-1",
    tipo: "listado",
    portal_id: "habitaclia",
    alerta_id: "alerta-1",
    url: "scheduler://habitaclia/listado",
    prioridad: 50,
    estado: "procesando",
    intentos: 1,
    payload: {
      pagina: 1,
      operacion: "venta",
      municipio: "Girona Capital",
      portal_params: {
        provincia_slug: "girona-provincia",
        municipio_slug: "girona-capital",
        solo_particulares: true,
      },
    },
  };
}

describe("procesarJob errores DB", () => {
  beforeEach(() => {
    fetchPagina.mockReset();
    guardarCrudo.mockReset();
    finalizarJob.mockReset();
    fetchPagina.mockResolvedValue({ status: 200, body: LISTADO, bytes: LISTADO.length });
    guardarCrudo.mockResolvedValue(undefined);
    finalizarJob.mockResolvedValue(undefined);
  });

  it("marca crawl_run como error si falla el insert de anuncio", async () => {
    const runs: Array<Record<string, unknown>> = [];
    const supabase = {
      from(table: string) {
        if (table === "captacion_anuncios") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: "columna_inexistente" },
                }),
              }),
            }),
          };
        }
        if (table === "crawl_runs") {
          return {
            insert: async (row: Record<string, unknown>) => {
              runs.push(row);
              return { error: null };
            },
          };
        }
        if (table === "crawl_jobs") {
          return {
            insert: async () => ({ error: null }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        return {};
      },
    };

    const { procesarJob } = await import("../src/pipeline/process-job.js");
    await procesarJob(supabase as never, jobListado());

    expect(runs.some((r) => r.estado === "error" && String(r.error).includes("insert"))).toBe(true);
    expect(finalizarJob).toHaveBeenCalledWith(
      supabase,
      "job-1",
      "error",
      expect.objectContaining({ error: expect.stringContaining("insert") })
    );
  });
});
