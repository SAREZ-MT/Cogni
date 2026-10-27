import { describe, expect, it } from "vitest";
import {
  docxHighlightToPalette,
  isMonospaceFont,
  normalizeHexColor,
  safeLinkHref,
} from "./imported-marks";

describe("safeLinkHref", () => {
  it("keeps http, https and mailto links", () => {
    expect(safeLinkHref("https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
    expect(safeLinkHref("http://example.com")).toBe("http://example.com");
    expect(safeLinkHref("mailto:ana@example.com")).toBe(
      "mailto:ana@example.com",
    );
  });

  it("drops every other scheme, relative links and empty values", () => {
    expect(safeLinkHref("javascript:alert(1)")).toBeNull();
    expect(safeLinkHref(" JavaScript:alert(1)")).toBeNull();
    expect(safeLinkHref("data:text/html,hi")).toBeNull();
    expect(safeLinkHref("vbscript:x")).toBeNull();
    expect(safeLinkHref("#bookmark")).toBeNull();
    expect(safeLinkHref("docs/page.html")).toBeNull();
    expect(safeLinkHref("https://")).toBeNull();
    expect(safeLinkHref("")).toBeNull();
    expect(safeLinkHref(null)).toBeNull();
  });

  it("trims surrounding whitespace before checking", () => {
    expect(safeLinkHref("  https://example.com  ")).toBe("https://example.com");
  });
});

describe("docxHighlightToPalette", () => {
  it("maps each Word highlight colour to the nearest catalogue palette name", () => {
    expect(docxHighlightToPalette("yellow")).toBe("yellow");
    expect(docxHighlightToPalette("green")).toBe("green");
    expect(docxHighlightToPalette("darkGreen")).toBe("green");
    expect(docxHighlightToPalette("cyan")).toBe("mint");
    expect(docxHighlightToPalette("darkCyan")).toBe("mint");
    expect(docxHighlightToPalette("blue")).toBe("blue");
    expect(docxHighlightToPalette("darkBlue")).toBe("blue");
    expect(docxHighlightToPalette("magenta")).toBe("purple");
    expect(docxHighlightToPalette("darkMagenta")).toBe("purple");
    expect(docxHighlightToPalette("red")).toBe("pink");
    expect(docxHighlightToPalette("darkRed")).toBe("pink");
    expect(docxHighlightToPalette("darkYellow")).toBe("orange");
  });

  it("returns null for none, greys, black, white and unknown names", () => {
    for (const name of [
      "none",
      "black",
      "white",
      "darkGray",
      "lightGray",
      "x",
    ]) {
      expect(docxHighlightToPalette(name)).toBeNull();
    }
    expect(docxHighlightToPalette(null)).toBeNull();
  });
});

describe("normalizeHexColor", () => {
  it("returns lowercase #rrggbb for 6-digit hex, with or without #", () => {
    expect(normalizeHexColor("#FF0000")).toBe("#ff0000");
    expect(normalizeHexColor("C6EFCE")).toBe("#c6efce");
  });

  it("returns null for anything else", () => {
    expect(normalizeHexColor("auto")).toBeNull();
    expect(normalizeHexColor("#FFF")).toBeNull();
    expect(normalizeHexColor("yellow")).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
  });
});

describe("isMonospaceFont", () => {
  it("recognises common monospace families", () => {
    for (const font of [
      "Courier New",
      "Courier",
      "Consolas",
      "Menlo",
      "Monaco",
      "Lucida Console",
      "Source Code Pro",
      "JetBrains Mono",
      "Cascadia Code",
    ]) {
      expect(isMonospaceFont(font)).toBe(true);
    }
  });

  it("rejects proportional fonts and missing values", () => {
    expect(isMonospaceFont("Calibri")).toBe(false);
    expect(isMonospaceFont("Times New Roman")).toBe(false);
    expect(isMonospaceFont(null)).toBe(false);
  });
});
