import { act, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensions } from "./extensions";

// Counts renders of the card: its icon only renders with the card itself.
const { iconRenders } = vi.hoisted(() => ({ iconRenders: { count: 0 } }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    ListTree: (props: object) => {
      iconRenders.count++;
      return createElement(actual.ListTree, props);
    },
  };
});

// The TOC node view computes its own heading list from the document on every
// `update`/`selectionUpdate`, so these tests drive a real editor through
// `EditorContent` and assert on what the card renders.
let editor: Editor | null = null;

function mount(content: object) {
  editor = new Editor({ extensions: createEditorExtensions(), content });
  return render(<EditorContent editor={editor} />);
}

const toc = { type: "tocBlock" };
const heading = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: text ? [{ type: "text", text }] : [],
});

describe("TocBlock", () => {
  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("shows the empty state while the page has no headings", async () => {
    mount({ type: "doc", content: [toc, { type: "paragraph" }] });

    expect(await screen.findByTestId("toc-block")).toBeVisible();
    expect(screen.getByText("Tabla de contenidos")).toBeVisible();
    expect(
      screen.getByText("Añade encabezados para ver el índice"),
    ).toBeVisible();
    expect(screen.queryAllByTestId("toc-block-item")).toHaveLength(0);
  });

  it("lists every heading indented by level, with a fallback for empty ones", async () => {
    mount({
      type: "doc",
      content: [
        toc,
        heading(1, "Célula"),
        heading(2, "Núcleo"),
        heading(3, ""),
      ],
    });

    const items = await screen.findAllByTestId("toc-block-item");

    expect(items.map((item) => item.textContent)).toEqual([
      "Célula",
      "Núcleo",
      "Sin título",
    ]);
    expect(items.map((item) => item.parentElement?.style.marginLeft)).toEqual([
      "0px",
      "12px",
      "24px",
    ]);
  });

  it("refreshes the list when a heading is added to the document", async () => {
    mount({ type: "doc", content: [toc, { type: "paragraph" }] });
    await screen.findByText("Añade encabezados para ver el índice");

    // Dispatched straight to the view so the selection does not move: only
    // the document `update` event can refresh the list here.
    await act(async () => {
      if (!editor) throw new Error("editor not mounted");
      const node = editor.state.schema.nodeFromJSON(heading(2, "Nuevo"));
      editor.view.dispatch(
        editor.state.tr.insert(editor.state.doc.content.size, node),
      );
    });

    const items = await screen.findAllByTestId("toc-block-item");
    expect(items.map((item) => item.textContent)).toEqual(["Nuevo"]);
    expect(
      screen.queryByText("Añade encabezados para ver el índice"),
    ).toBeNull();
  });

  it("moves the selection to the heading when its entry is clicked", async () => {
    mount({
      type: "doc",
      content: [toc, heading(1, "Célula"), { type: "paragraph" }],
    });
    const [item] = await screen.findAllByTestId("toc-block-item");

    await act(async () => {
      item.click();
    });

    // The caret lands inside the heading, not on the block boundary.
    expect(editor?.state.selection.$from.parent.type.name).toBe("heading");
  });

  // Regression ("Maximum update depth exceeded" right after load): every
  // update/selectionUpdate used to hand React a brand-new array even when the
  // headings were unchanged, re-rendering the card forever.
  it("does not re-render the card when only the selection moves", async () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [toc, heading(1, "Célula"), { type: "paragraph" }],
      },
    });
    render(<EditorContent editor={editor} />);
    await screen.findAllByTestId("toc-block-item");
    const before = iconRenders.count;

    for (const pos of [3, 4, 3, 4, 3, 4]) {
      await act(async () => {
        editor?.commands.setTextSelection(pos);
      });
    }

    // Moving the selection never changes the headings: at most the initial
    // settle may re-render, never one render per move.
    expect(iconRenders.count - before).toBeLessThanOrEqual(1);
  });
});
