import { describe, expect, it } from "vitest";
import { CATALOGUE_SAMPLE_DOC } from "@/shared/kernel/tiptap-catalogue";
import { tiptapContentSchema, tiptapDocSchema } from "./content-schema";

const OFF_CATALOGUE_DOC = {
  type: "doc",
  content: [{ type: "video", attrs: { src: "https://example.com/x.mp4" } }],
};

describe("tiptapContentSchema (strict, import path)", () => {
  it("accepts the catalogue sample document unchanged", () => {
    const parsed = tiptapContentSchema.safeParse(CATALOGUE_SAMPLE_DOC);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual(CATALOGUE_SAMPLE_DOC);
  });

  it("rejects a node outside the catalogue", () => {
    expect(tiptapContentSchema.safeParse(OFF_CATALOGUE_DOC).success).toBe(
      false,
    );
  });

  it("rejects a javascript: link", () => {
    const parsed = tiptapContentSchema.safeParse({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "clic",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown node key instead of silently stripping it", () => {
    const parsed = tiptapContentSchema.safeParse({
      type: "doc",
      content: [
        {
          type: "paragraph",
          html: "<script></script>",
          content: [{ type: "text", text: "a" }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("still rejects a root that is not a doc", () => {
    expect(tiptapContentSchema.safeParse({ type: "paragraph" }).success).toBe(
      false,
    );
  });

  it("points the issue path at the offending node", () => {
    const parsed = tiptapContentSchema.safeParse(OFF_CATALOGUE_DOC);
    expect(!parsed.success && parsed.error.issues[0]?.path).toEqual([
      "content",
      0,
    ]);
  });

  // The doc-level "at least one block" rule is invariant 2 of
  // writeImportedContent (PAGE_INVALID_CONTENT), not a shape error.
  it("leaves an empty doc to the use case's own invariant", () => {
    expect(
      tiptapContentSchema.safeParse({ type: "doc", content: [] }).success,
    ).toBe(true);
  });
});

describe("tiptapDocSchema (permissive, editor autosave path)", () => {
  it("still accepts a node outside the catalogue", () => {
    expect(tiptapDocSchema.safeParse(OFF_CATALOGUE_DOC).success).toBe(true);
  });
});
