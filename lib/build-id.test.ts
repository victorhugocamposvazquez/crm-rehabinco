import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("build-id", () => {
  it("expone un identificador no vacío", async () => {
    const { BUILD_ID } = await import("./build-id");
    assert.equal(typeof BUILD_ID, "string");
    assert.ok(BUILD_ID.length > 0);
  });
});
