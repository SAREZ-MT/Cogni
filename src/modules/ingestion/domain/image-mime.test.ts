import { describe, expect, it } from "vitest";
import { sniffImageMime } from "./image-mime";

const bytes = (...values: number[]) => new Uint8Array(values);

// The page-assets bucket keeps png/jpeg/gif/webp only, and parsers report
// unreliable content types (officeparser says octet-stream for SVG), so
// the importer trusts the magic bytes alone.
describe("sniffImageMime", () => {
  it("recognises png, jpeg, gif and webp", () => {
    expect(
      sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageMime(new TextEncoder().encode("GIF89a..."))).toBe(
      "image/gif",
    );
    expect(
      sniffImageMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")),
    ).toBe("image/webp");
  });

  it("returns null for formats the page assets do not keep (svg, emf, wmf, tiff)", () => {
    expect(sniffImageMime(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffImageMime(bytes(0x01, 0x00, 0x00, 0x00, 0, 0))).toBeNull(); // EMF
    expect(sniffImageMime(bytes(0xd7, 0xcd, 0xc6, 0x9a))).toBeNull(); // WMF
    expect(sniffImageMime(bytes(0x49, 0x49, 0x2a, 0x00))).toBeNull(); // TIFF
    expect(
      sniffImageMime(new TextEncoder().encode("RIFF\0\0\0\0WAVE")),
    ).toBeNull();
  });

  it("returns null for empty or truncated input", () => {
    expect(sniffImageMime(new Uint8Array())).toBeNull();
    expect(sniffImageMime(bytes(0x89, 0x50))).toBeNull();
  });
});
