import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConsentimiento, serializarConsentimiento } from "./cookie-consent";

describe("cookie consent", () => {
  it("serializa y parsea preferencias", () => {
    const raw = serializarConsentimiento({
      v: 1,
      necessary: true,
      preferences: true,
      analytics: false,
      marketing: false,
      ts: 1,
    });
    const parsed = parseConsentimiento(decodeURIComponent(raw));
    assert.ok(parsed);
    assert.equal(parsed.preferences, true);
    assert.equal(parsed.analytics, false);
  });
});
