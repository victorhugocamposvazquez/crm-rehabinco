import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCrmPropertyIntegration, errorDesdeRpc } from "./property-integration";

describe("Adaptador CRM Property", () => {
  it("mapea errores RPC a códigos de orquestación", () => {
    assert.deepEqual(errorDesdeRpc("42501", "FORBIDDEN"), { ok: false, error: "FORBIDDEN" });
    assert.deepEqual(errorDesdeRpc("P0002", "FINCA_NOT_FOUND"), { ok: false, error: "NOT_FOUND" });
    assert.deepEqual(errorDesdeRpc("22023", "OFERTANTE_REQUIRED"), { ok: false, error: "OFERTANTE_REQUIRED" });
    assert.deepEqual(errorDesdeRpc("23502", "insert into propiedades"), { ok: false, error: "PROPERTY_FAILED" });
    assert.deepEqual(errorDesdeRpc("23503", "catastro_property_links"), { ok: false, error: "LINK_FAILED" });
  });

  it("reutiliza el vínculo existente y no inventa Property.id como fincaReference", async () => {
    const integration = createCrmPropertyIntegration({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                finca_reference: "2749704YJ0624N",
                property_id: "prop-uuid",
                source: "CATASTRO_EXPLORER",
                linked_at: "2026-09-12T11:00:00.000Z",
              },
              error: null,
            }),
          }),
          in: async () => ({ data: [], error: null }),
        }),
      }),
      rpc: async () => ({ data: null, error: { message: "should not run" } }),
    });
    const links = await integration.findLinksByFincaReference("2749704YJ0624N");
    assert.equal(links[0]?.fincaReference, "2749704YJ0624N");
    assert.equal(links[0]?.propertyId, "prop-uuid");
    assert.notEqual(links[0]?.propertyId, links[0]?.fincaReference);
  });
});
