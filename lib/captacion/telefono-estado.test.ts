import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cuentaSinTelefonoChip, cuentaSoloMensajeChip, resolverEstadoTelefono } from "./telefono-estado";

const base = {
  fuente: "idealista" as const,
  anunciante: "particular" as const,
  contacto_telefono: null,
};

describe("estados de teléfono en UI", () => {
  it("mapea los seis estados", () => {
    assert.equal(resolverEstadoTelefono({ ...base, telefono_estado: "pendiente" }), "pendiente");
    assert.equal(resolverEstadoTelefono({ ...base, telefono_estado: "solo_mensaje" }), "solo_mensaje");
    assert.equal(
      resolverEstadoTelefono({ ...base, telefono_estado: "virtual", contacto_telefono: "+348813512345" }),
      "virtual"
    );
    assert.equal(
      resolverEstadoTelefono({ ...base, telefono_estado: "real", contacto_telefono: "+34600111222" }),
      "real"
    );
    assert.equal(resolverEstadoTelefono({ ...base, telefono_estado: "fallo", telefono_pendiente: true }), "fallo");
    assert.equal(
      resolverEstadoTelefono({ ...base, anunciante: "empresa", telefono_estado: "no_solicitado" }),
      "no_solicitado"
    );
  });

  it("sin teléfono chip = pendiente + fallo", () => {
    assert.equal(cuentaSinTelefonoChip({ ...base, telefono_estado: "pendiente" }, false), true);
    assert.equal(cuentaSinTelefonoChip({ ...base, telefono_estado: "fallo" }, false), true);
    assert.equal(cuentaSinTelefonoChip({ ...base, telefono_estado: "solo_mensaje" }, false), false);
    assert.equal(cuentaSinTelefonoChip({ ...base, telefono_estado: "virtual", contacto_telefono: "+348813512345" }, false), false);
    assert.equal(cuentaSoloMensajeChip({ ...base, telefono_estado: "solo_mensaje" }), true);
  });
});
