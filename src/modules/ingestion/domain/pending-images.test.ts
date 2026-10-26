import { describe, expect, it } from "vitest";
import type {
  ImportedBlock,
  ImportedDoc,
  ImportedParagraph,
} from "./imported-doc";
import { pendingImageKeys, resolvePendingImages } from "./pending-images";

const ASSET_A = "11111111-1111-4111-8111-111111111111";
const ASSET_B = "22222222-2222-4222-8222-222222222222";

function pending(key: string, alt: string | null = null): ImportedBlock {
  return {
    type: "image",
    attrs: { assetId: null, pendingId: key, align: "center", alt },
  };
}

function stored(assetId: string, alt: string | null = null): ImportedBlock {
  return { type: "image", attrs: { assetId, align: "center", alt } };
}

function paragraph(text: string): ImportedParagraph {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

const EMPTY_PARAGRAPH: ImportedBlock = { type: "paragraph" };

function doc(...content: ImportedBlock[]): ImportedDoc {
  return { type: "doc", content };
}

describe("resolvePendingImages", () => {
  it("swaps pendingId for the resolved assetId and keeps the other attrs", () => {
    const result = resolvePendingImages(
      doc(paragraph("a"), pending("img-1", "Diagrama")),
      new Map([["img-1", ASSET_A]]),
    );

    expect(result.removed).toBe(0);
    expect(result.content).toEqual(
      doc(paragraph("a"), stored(ASSET_A, "Diagrama")),
    );
    expect(JSON.stringify(result.content)).not.toContain("pendingId");
  });

  it("removes images whose key was not resolved and counts them", () => {
    const result = resolvePendingImages(
      doc(pending("img-1"), paragraph("a"), pending("img-2"), pending("img-3")),
      new Map([["img-2", ASSET_B]]),
    );

    expect(result.removed).toBe(2);
    expect(result.content).toEqual(doc(paragraph("a"), stored(ASSET_B)));
  });

  it("leaves images that already carry an assetId untouched", () => {
    const original = doc(stored(ASSET_A), paragraph("a"));

    const result = resolvePendingImages(original, new Map());

    expect(result).toEqual({ content: original, removed: 0 });
  });

  it("does not mutate its input", () => {
    const original = doc(pending("img-1"), paragraph("a"));
    const snapshot = structuredClone(original);

    resolvePendingImages(original, new Map([["img-1", ASSET_A]]));

    expect(original).toEqual(snapshot);
  });

  it("resolves and removes images nested in list items, task items and table cells", () => {
    const result = resolvePendingImages(
      doc(
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [paragraph("item"), pending("img-1"), pending("gone")],
            },
          ],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [paragraph("task"), pending("img-2")],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [pending("img-1")] },
                { type: "tableHeader", content: [pending("gone-too")] },
              ],
            },
          ],
        },
      ),
      new Map([
        ["img-1", ASSET_A],
        ["img-2", ASSET_B],
      ]),
    );

    expect(result.removed).toBe(2);
    expect(result.content).toEqual(
      doc(
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [paragraph("item"), stored(ASSET_A)] },
          ],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [paragraph("task"), stored(ASSET_B)],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [stored(ASSET_A)] },
                // A cell needs at least one block: an empty paragraph keeps
                // the table shape valid for the content catalogue.
                { type: "tableHeader", content: [EMPTY_PARAGRAPH] },
              ],
            },
          ],
        },
      ),
    );
  });

  it("resolves and removes images nested in callouts, blockquotes and details", () => {
    const result = resolvePendingImages(
      doc(
        {
          type: "callout",
          attrs: { kind: "note" },
          content: [pending("img-1")],
        },
        { type: "blockquote", content: [pending("gone")] },
        {
          type: "details",
          attrs: { open: false },
          content: [
            {
              type: "detailsSummary",
              content: [{ type: "text", text: "Más" }],
            },
            {
              type: "detailsContent",
              content: [paragraph("x"), pending("img-1"), pending("gone")],
            },
          ],
        },
      ),
      new Map([["img-1", ASSET_A]]),
    );

    expect(result.removed).toBe(2);
    expect(result.content).toEqual(
      doc(
        {
          type: "callout",
          attrs: { kind: "note" },
          content: [stored(ASSET_A)],
        },
        { type: "blockquote", content: [EMPTY_PARAGRAPH] },
        {
          type: "details",
          attrs: { open: false },
          content: [
            {
              type: "detailsSummary",
              content: [{ type: "text", text: "Más" }],
            },
            {
              type: "detailsContent",
              content: [paragraph("x"), stored(ASSET_A)],
            },
          ],
        },
      ),
    );
  });
});

describe("pendingImageKeys", () => {
  it("lists every pending key once, in document order, including nested ones", () => {
    const keys = pendingImageKeys(
      doc(pending("img-2"), stored(ASSET_A), {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [pending("img-1")] },
              { type: "tableCell", content: [pending("img-2")] },
            ],
          },
        ],
      }),
    );

    expect(keys).toEqual(["img-2", "img-1"]);
  });
});
