import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("stamp-sw-build", () => {
  it("escribe el BUILD_STAMP en sw.js", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-sw-"));
    const swPath = path.join(tmp, "public", "sw.js");
    fs.mkdirSync(path.dirname(swPath), { recursive: true });
    fs.copyFileSync(path.join(root, "public", "sw.js"), swPath);

    const res = spawnSync("node", [path.join(root, "scripts", "stamp-sw-build.mjs")], {
      cwd: tmp,
      env: { ...process.env, VERCEL_GIT_COMMIT_SHA: "abc123deadbeef" },
      encoding: "utf8",
    });
    assert.equal(res.status, 0, res.stderr || res.stdout);

    const stamped = fs.readFileSync(swPath, "utf8");
    assert.match(stamped, /\/\/ BUILD_STAMP: abc123deadbeef/);
    assert.equal((stamped.match(/\/\/ BUILD_STAMP:/g) ?? []).length, 1);
  });
});
