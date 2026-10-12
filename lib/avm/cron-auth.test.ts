import { describe, expect, it, afterEach } from "vitest";
import { avmCronAutorizado } from "./cron-auth";

describe("avmCronAutorizado", () => {
  const previo = process.env.CRON_SECRET;

  afterEach(() => {
    if (previo == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previo;
  });

  it("acepta Authorization Bearer CRON_SECRET como catastro-zone", () => {
    process.env.CRON_SECRET = "s3creto";
    expect(
      avmCronAutorizado(
        new Request("http://crm.local/api/avm/crawl", {
          headers: { authorization: "Bearer s3creto" },
        }),
      ),
    ).toBe(true);
  });

  it("rechaza sin cabecera o con secreto vacío en entorno", () => {
    process.env.CRON_SECRET = "";
    expect(
      avmCronAutorizado(
        new Request("http://crm.local/api/avm/crawl", {
          headers: { authorization: "Bearer s3creto" },
        }),
      ),
    ).toBe(false);
  });
});
