import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectBlockIds,
  isBlockIdOnlyChange,
  stripBlockIds,
} from "./block-ids";
import { createEditorExtensions } from "./extensions";

const doc = (blockId: string | null, text = "hola") => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { blockId, textAlign: null },
      content: [{ type: "text", text }],
    },
    {
      type: "bulletList",
      attrs: { blockId: blockId && `${blockId}-list` },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              attrs: { blockId: blockId && `${blockId}-nested` },
            },
          ],
        },
      ],
    },
  ],
});

describe("collectBlockIds", () => {
  it("collects every string blockId, nested ones included", () => {
    expect(collectBlockIds(doc("a"))).toEqual(
      new Set(["a", "a-list", "a-nested"]),
    );
  });

  it("ignores empty ids", () => {
    const empty = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { blockId: "" } }],
    };
    expect(collectBlockIds(empty).size).toBe(0);
  });

  it("ignores null and missing ids", () => {
    expect(collectBlockIds(doc(null)).size).toBe(0);
    expect(
      collectBlockIds({ type: "doc", content: [{ type: "paragraph" }] }).size,
    ).toBe(0);
  });
});

describe("stripBlockIds", () => {
  it("removes blockId at every depth and leaves other attrs and text alone", () => {
    const stripped = stripBlockIds(doc("a"));
    expect(JSON.stringify(stripped)).not.toContain("blockId");
    expect(stripped.content?.[0].attrs).toEqual({ textAlign: null });
    expect(stripped.content?.[0].content?.[0].text).toBe("hola");
  });

  it("does not mutate its input", () => {
    const input = doc("a");
    stripBlockIds(input);
    expect(collectBlockIds(input).size).toBe(3);
  });
});

describe("isBlockIdOnlyChange", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function nodes(before: object, after: object) {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: before,
    });
    const schema = editor.state.schema;
    return {
      before: schema.nodeFromJSON(before),
      after: schema.nodeFromJSON(after),
    };
  }

  it("is true when only block ids differ", () => {
    const { before, after } = nodes(doc(null), doc("a"));
    expect(isBlockIdOnlyChange(before, after)).toBe(true);
  });

  it("is false when the text differs, even if ids differ too", () => {
    const { before, after } = nodes(doc(null), doc("a", "otro"));
    expect(isBlockIdOnlyChange(before, after)).toBe(false);
  });

  it("is false when another attribute differs", () => {
    const changed = doc("a");
    (changed.content[0].attrs as Record<string, unknown>).textAlign = "center";
    const { before, after } = nodes(doc("a"), changed);
    expect(isBlockIdOnlyChange(before, after)).toBe(false);
  });
});
