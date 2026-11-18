import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clienteDeFactura, conClienteFicha } from "./cliente-opcion";

describe("cliente de la factura", () => {
  it("usa el nombre embebido y, si falta, conserva el id", () => {
    assert.deepEqual(clienteDeFactura({ id: "c1", nombre: " Ana " }, "c1"), { id: "c1", nombre: "Ana" });
    assert.deepEqual(clienteDeFactura([{ id: "c1", nombre: "Ana" }], "c1"), { id: "c1", nombre: "Ana" });
    assert.deepEqual(clienteDeFactura(null, "c1"), { id: "c1", nombre: "Cliente de la factura" });
    assert.equal(clienteDeFactura(null, null), null);
  });

  it("añade el cliente de la ficha si el listado no lo trae", () => {
    const lista = [{ id: "b", nombre: "Bea" }];
    const conFicha = conClienteFicha(lista, { id: "a", nombre: "Ana" });
    assert.deepEqual(conFicha.map((c) => c.id), ["a", "b"]);
    assert.equal(conClienteFicha(lista, { id: "b", nombre: "Bea" }), lista);
  });
});
