import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decisionHost, dominioParaGuardar, hrefInmueble, normalizarDominio } from "./dominio";

describe("dominio de la web", () => {
  it("acepta un subdominio y rechaza el del CRM", () => {
    assert.equal(normalizarDominio("https://Web.rehabinco.es/"), "web.rehabinco.es");
    assert.equal(normalizarDominio("crm.rehabinco.es"), null);
    assert.equal(normalizarDominio("localhost"), null);
    const vacio = dominioParaGuardar("  ");
    assert.equal(vacio.ok, true);
    if (vacio.ok) assert.equal(vacio.dominio, null);
  });

  it("en web.rehabinco.es la raíz es la web y el CRM se va a su dominio", () => {
    assert.deepEqual(decisionHost("web.rehabinco.es", "/", "web.rehabinco.es"), { tipo: "reescribir", pathname: "/web" });
    assert.deepEqual(decisionHost("web.rehabinco.es", "/inmuebles/RHB-1", "web.rehabinco.es"), {
      tipo: "reescribir",
      pathname: "/web/inmuebles/RHB-1",
    });
    assert.deepEqual(decisionHost("web.rehabinco.es", "/web", "web.rehabinco.es"), { tipo: "canonical", pathname: "/" });
    assert.equal(decisionHost("web.rehabinco.es", "/propiedades", "web.rehabinco.es").tipo, "al-crm");
    assert.equal(decisionHost("crm.rehabinco.es", "/", "web.rehabinco.es").tipo, "crm");
    assert.equal(hrefInmueble(true, "RHB-1"), "/inmuebles/RHB-1");
    assert.equal(hrefInmueble(false, "RHB-1"), "/web/inmuebles/RHB-1");
  });
});
