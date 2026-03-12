import { describe, it, expect } from "vitest";
import { createSignature } from "@/lib/bybit/signing";

describe("Bybit HMAC-SHA256 signing", () => {
  it("generates consistent signature for same inputs", () => {
    const sig1 = createSignature("1234567890", "testkey", "param=value", "testsecret");
    const sig2 = createSignature("1234567890", "testkey", "param=value", "testsecret");
    expect(sig1).toBe(sig2);
  });

  it("generates different signatures for different timestamps", () => {
    const sig1 = createSignature("1234567890", "testkey", "param=value", "testsecret");
    const sig2 = createSignature("1234567891", "testkey", "param=value", "testsecret");
    expect(sig1).not.toBe(sig2);
  });

  it("generates 64-char hex string", () => {
    const sig = createSignature("1234567890", "testkey", "", "testsecret");
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("includes all components in signature", () => {
    // Signature should change when any component changes
    const base = createSignature("1000", "key", "q=1", "secret");
    const diffTimestamp = createSignature("2000", "key", "q=1", "secret");
    const diffKey = createSignature("1000", "key2", "q=1", "secret");
    const diffQuery = createSignature("1000", "key", "q=2", "secret");

    expect(base).not.toBe(diffTimestamp);
    expect(base).not.toBe(diffKey);
    expect(base).not.toBe(diffQuery);
  });
});
