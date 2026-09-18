import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts an internal path", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/reset-password?x=1")).toBe("/reset-password?x=1");
  });

  it("falls back to the root for external or protocol-relative targets", () => {
    expect(safeNext("https://evil.tld")).toBe("/");
    expect(safeNext("//evil.tld")).toBe("/");
    expect(safeNext("/\\evil.tld")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("falls back to the root when the value is missing or empty", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});
