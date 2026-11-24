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

  it("keeps the query string and the fragment of an internal path", () => {
    expect(safeNext("/notebooks/abc?tab=1#top")).toBe(
      "/notebooks/abc?tab=1#top",
    );
  });

  // Browsers drop tabs and line breaks from a URL before resolving it, so
  // "/<tab>/evil.tld" is the protocol-relative "//evil.tld" to them.
  it.each([
    "/\t/evil.tld",
    "/\n/evil.tld",
    "/\r/evil.tld",
    "/\t\\evil.tld",
    "\t//evil.tld",
    " //evil.tld",
  ])("falls back to Inicio for a target a browser resolves off-site (%j)", (target) => {
    expect(safeNext(target)).toBe("/inicio");
  });

  // Dot segments collapse during resolution: "/.//host" becomes the path
  // "//host", which would be protocol-relative if it were returned as is.
  it.each([
    "/.//evil.tld",
    "/..//evil.tld",
    "/a/..//evil.tld",
    "/%2e//evil.tld",
    "/a/%2e%2e//evil.tld",
    "/./\\evil.tld",
  ])("falls back to Inicio when the resolved path would start with two slashes (%j)", (target) => {
    expect(safeNext(target)).toBe("/inicio");
  });

  it("returns the resolved form of an internal path with dot segments", () => {
    expect(safeNext("/notebooks/../dashboard")).toBe("/dashboard");
  });

  it("falls back to Inicio for a relative path or a bare host", () => {
    expect(safeNext("dashboard")).toBe("/inicio");
    expect(safeNext("evil.tld/path")).toBe("/inicio");
  });
});
