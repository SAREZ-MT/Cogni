import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts an internal path", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/reset-password?x=1")).toBe("/reset-password?x=1");
  });

  it("falls back to Inicio for external or protocol-relative targets", () => {
    expect(safeNext("https://evil.tld")).toBe("/inicio");
    expect(safeNext("//evil.tld")).toBe("/inicio");
    expect(safeNext("/\\evil.tld")).toBe("/inicio");
    expect(safeNext("javascript:alert(1)")).toBe("/inicio");
  });

  it("falls back to Inicio when the value is missing or empty", () => {
    expect(safeNext(null)).toBe("/inicio");
    expect(safeNext(undefined)).toBe("/inicio");
    expect(safeNext("")).toBe("/inicio");
  });
});
