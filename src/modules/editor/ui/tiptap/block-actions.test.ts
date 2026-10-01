import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  blockLinkFragment,
  copyBlock,
  copyBlockLink,
  currentBlock,
  deleteBlock,
  duplicateBlock,
  resetBlockFormatting,
  resolveBlockAt,
} from "./block-actions";
import { createEditorExtensions } from "./extensions";

function createHeadlessEditor(content: string) {
  return new Editor({ extensions: createEditorExtensions(), content });
}

// UniqueID assigns block ids from the editor's asynchronous `create` hook.
async function waitForBlockIds(editor: Editor) {
  await vi.waitFor(() =>
    expect(editor.state.doc.firstChild?.attrs.blockId).toEqual(
      expect.any(String),
    ),
  );
}

function texts(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.forEach((node) => {
    out.push(node.textContent);
  });
  return out;
}

function blockAt(editor: Editor, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
  const ref = resolveBlockAt(editor, pos);
  if (!ref) throw new Error(`no block at index ${index}`);
  return ref;
}

describe("block actions", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
    vi.unstubAllGlobals();
  });

  describe("resolveBlockAt", () => {
    beforeEach(() => {
      editor = createHeadlessEditor("<p>uno</p><p>dos</p>");
    });

    it("returns the node and position of the block starting at pos", () => {
      const ref = resolveBlockAt(editor, editor.state.doc.child(0).nodeSize);
      expect(ref?.node.textContent).toBe("dos");
    });

    it("returns null for a position outside the current document", () => {
      expect(resolveBlockAt(editor, -1)).toBeNull();
      expect(resolveBlockAt(editor, editor.state.doc.content.size)).toBeNull();
      expect(resolveBlockAt(editor, 9999)).toBeNull();
    });
  });

  describe("currentBlock", () => {
    it("returns the top-level block that contains the selection head", () => {
      editor = createHeadlessEditor("<p>uno</p><ul><li>dos</li></ul>");
      editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 3);

      const ref = currentBlock(editor);

      expect(ref?.node.type.name).toBe("bulletList");
    });
  });

  describe("duplicateBlock", () => {
    it("inserts a copy right after the block, keeping the original first", async () => {
      editor = createHeadlessEditor("<p>uno</p><p>dos</p>");
      await waitForBlockIds(editor);
      const originalId = editor.state.doc.child(0).attrs.blockId;

      duplicateBlock(editor, blockAt(editor, 0));

      expect(texts(editor)).toEqual(["uno", "uno", "dos"]);
      expect(editor.state.doc.child(0).attrs.blockId).toBe(originalId);
      expect(editor.state.doc.child(1).attrs.blockId).not.toBe(originalId);
    });

    it("gives the copy its own stable block id", async () => {
      editor = createHeadlessEditor("<p>uno</p>");
      await waitForBlockIds(editor);
      duplicateBlock(editor, blockAt(editor, 0));

      const ids = [0, 1].map((i) => editor.state.doc.child(i).attrs.blockId);
      expect(ids[0]).toEqual(expect.any(String));
      expect(ids[1]).toEqual(expect.any(String));
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("duplicateBlock with nested blocks", () => {
    it("never leaves two blocks sharing an id, nested ones included", async () => {
      editor = createHeadlessEditor("<ul><li><p>uno</p></li></ul>");
      await waitForBlockIds(editor);

      duplicateBlock(editor, blockAt(editor, 0));

      const ids: string[] = [];
      editor.state.doc.descendants((node) => {
        if (typeof node.attrs.blockId === "string")
          ids.push(node.attrs.blockId);
      });
      expect(ids.length).toBeGreaterThanOrEqual(4);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("deleteBlock", () => {
    it("removes exactly that block", () => {
      editor = createHeadlessEditor("<p>uno</p><p>dos</p><p>tres</p>");

      deleteBlock(editor, blockAt(editor, 1));

      expect(texts(editor)).toEqual(["uno", "tres"]);
    });
  });

  describe("resetBlockFormatting", () => {
    it("clears inline marks over the whole block content", () => {
      editor = createHeadlessEditor(
        "<p><strong>negrita</strong> y <em>cursiva</em></p>",
      );

      resetBlockFormatting(editor, blockAt(editor, 0));

      expect(editor.isActive("bold")).toBe(false);
      const marks = editor.state.doc.child(0).children.flatMap((c) => c.marks);
      expect(marks).toHaveLength(0);
      expect(texts(editor)).toEqual(["negrita y cursiva"]);
    });

    it("clears a block background on a type that supports one", () => {
      editor = createHeadlessEditor("<p>hola</p>");
      editor
        .chain()
        .setNodeSelection(0)
        .updateAttributes("paragraph", { nodeBackground: "pink" })
        .run();
      expect(editor.state.doc.child(0).attrs.nodeBackground).toBe("pink");

      resetBlockFormatting(editor, blockAt(editor, 0));

      expect(editor.state.doc.child(0).attrs.nodeBackground).toBeNull();
    });

    it("leaves a type without background support alone", () => {
      editor = createHeadlessEditor("<pre><code>x = 1</code></pre>");

      expect(() =>
        resetBlockFormatting(editor, blockAt(editor, 0)),
      ).not.toThrow();
      expect(editor.state.doc.child(0).type.name).toBe("codeBlock");
    });
  });

  describe("blockLinkFragment / copyBlockLink", () => {
    it("builds a #block-<id> fragment from the block's blockId", async () => {
      editor = createHeadlessEditor("<p>hola</p>");
      await waitForBlockIds(editor);
      const ref = blockAt(editor, 0);
      const id = ref.node.attrs.blockId as string;

      expect(id).toEqual(expect.any(String));
      expect(blockLinkFragment(ref)).toBe(`#block-${id}`);
    });

    it("returns null for a block that has no id yet", () => {
      editor = createHeadlessEditor("<p>hola</p>");
      const ref = blockAt(editor, 0);
      const bare = {
        ...ref,
        node: { attrs: {} } as unknown as typeof ref.node,
      };
      expect(blockLinkFragment(bare)).toBeNull();
    });

    it("treats an empty id like a missing one", async () => {
      editor = createHeadlessEditor("<p>hola</p>");
      const ref = blockAt(editor, 0);
      const blank = {
        ...ref,
        node: { attrs: { blockId: "" } } as unknown as typeof ref.node,
      };
      expect(blockLinkFragment(blank)).toBeNull();
    });

    it("copies the absolute page URL plus the fragment", async () => {
      editor = createHeadlessEditor("<p>hola</p>");
      await waitForBlockIds(editor);
      const ref = blockAt(editor, 0);
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      copyBlockLink(ref);

      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}${window.location.pathname}#block-${ref.node.attrs.blockId}`,
      );
    });

    it("copies nothing when the block has no id", () => {
      editor = createHeadlessEditor("<p>hola</p>");
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      copyBlockLink({
        pos: 0,
        node: { attrs: {} } as unknown as ReturnType<typeof blockAt>["node"],
      });

      expect(writeText).not.toHaveBeenCalled();
    });
  });

  describe("copyBlock", () => {
    it("writes the block's plain text when multi-type clipboard writes are unavailable", () => {
      editor = createHeadlessEditor("<p>texto del bloque</p>");
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      copyBlock(editor, blockAt(editor, 0));

      expect(writeText).toHaveBeenCalledWith("texto del bloque");
    });

    it("writes text and html together when ClipboardItem is available", async () => {
      editor = createHeadlessEditor("<p>texto del bloque</p>");
      const write = vi.fn().mockResolvedValue(undefined);
      const items: Record<string, Blob>[] = [];
      vi.stubGlobal(
        "ClipboardItem",
        class {
          constructor(data: Record<string, Blob>) {
            items.push(data);
          }
        },
      );
      vi.stubGlobal("navigator", { clipboard: { write, writeText: vi.fn() } });

      copyBlock(editor, blockAt(editor, 0));

      expect(write).toHaveBeenCalledTimes(1);
      expect(Object.keys(items[0]).sort()).toEqual(["text/html", "text/plain"]);
      expect(await items[0]["text/plain"].text()).toBe("texto del bloque");
      expect(await items[0]["text/html"].text()).toContain("texto del bloque");
    });

    it("falls back to plain text when the rich write is rejected", async () => {
      editor = createHeadlessEditor("<p>texto</p>");
      const write = vi.fn().mockRejectedValue(new Error("denied"));
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("ClipboardItem", class {});
      vi.stubGlobal("navigator", { clipboard: { write, writeText } });

      copyBlock(editor, blockAt(editor, 0));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("texto"));
    });

    it("does nothing without a clipboard", () => {
      editor = createHeadlessEditor("<p>texto</p>");
      vi.stubGlobal("navigator", {});
      expect(() => copyBlock(editor, blockAt(editor, 0))).not.toThrow();
    });
  });
});
