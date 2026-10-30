import { describe, expect, it } from "vitest";
import { notebookToneFromColor } from "./notebook-swatches";

describe("notebookToneFromColor", () => {
  it("keeps a palette colour", () => {
    expect(notebookToneFromColor("mint")).toBe("mint");
  });

  it("falls back to purple without a stored colour", () => {
    expect(notebookToneFromColor(null)).toBe("purple");
  });

  // Phase 8 V9: `notebooks.color` is free text; a legacy or hand-edited
  // value used to reach IconTile as an unknown tone (no tone class).
  it("falls back to purple for a colour outside the palette", () => {
    expect(notebookToneFromColor("teal")).toBe("purple");
  });
});
