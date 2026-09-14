import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cronZonaAutorizado } from "./zone-tick";

describe("tick de zona en servidor", () => {
  const previo = process.env.CRON_SECRET;
  afterEach(() => {
    if (previo == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previo;
  });

  it("el cron exige el secreto", () => {
    process.env.CRON_SECRET = "s3creto";
    assert.equal(
      cronZonaAutorizado(
        new Request("http://crm.local/api/cron/catastro-zone", { headers: { authorization: "Bearer s3creto" } })
      ),
      true
    );
    assert.equal(cronZonaAutorizado(new Request("http://crm.local/api/cron/catastro-zone")), false);
    process.env.CRON_SECRET = "";
    assert.equal(
      cronZonaAutorizado(
        new Request("http://crm.local/api/cron/catastro-zone", { headers: { authorization: "Bearer s3creto" } })
      ),
      false
    );
  });
});
