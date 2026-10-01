import { act, cleanup, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { SuggestionProps } from "@tiptap/suggestion";
import { FileText } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MentionCandidate } from "../../domain/mention-port";
import { createEditorExtensions } from "./extensions";
import { createMentionSuggestion } from "./mention-node";

const candidate: MentionCandidate = {
  id: "page-1",
  title: "Mitosis",
  notebookId: "nb-1",
  notebookTitle: "Biología",
  notebookColor: "mint",
};

describe("createMentionSuggestion", () => {
  it("resolves an always-empty list when there is no port", async () => {
    const suggestion = createMentionSuggestion(null);
    await expect(suggestion.items({ query: "mi" })).resolves.toEqual([]);
  });

  it("maps port candidates to menu items (title as label, notebook as hint, page icon tinted by the notebook color)", async () => {
    const search = vi.fn().mockResolvedValue([candidate]);
    const suggestion = createMentionSuggestion({ search });

    const items = await suggestion.items({ query: "mi" });

    expect(search).toHaveBeenCalledWith("mi");
    expect(items).toEqual([
      {
        id: "page-1",
        label: "Mitosis",
        description: "Biología",
        icon: FileText,
        iconTone: "mint",
        candidate,
      },
    ]);
  });

  it("leaves the icon tone unset when the notebook has no color", async () => {
    const search = vi
      .fn()
      .mockResolvedValue([{ ...candidate, notebookColor: null }]);
    const suggestion = createMentionSuggestion({ search });

    const items = await suggestion.items({ query: "mi" });

    expect(items[0].iconTone).toBeUndefined();
  });
});

describe("mention popup empty state", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("says there are no pages to mention, not that no block was found", async () => {
    const renderer = createMentionSuggestion(null).render?.();
    const props = {
      items: [],
      query: "zzz",
      command: vi.fn(),
      mount: vi.fn((element: HTMLElement) => {
        document.body.appendChild(element);
        return () => element.remove();
      }),
    } as unknown as SuggestionProps;

    await act(async () => renderer?.onStart?.(props));

    expect(screen.getByText("No hay páginas para mencionar")).toBeVisible();
    expect(
      screen.queryByText("No se encontraron bloques"),
    ).not.toBeInTheDocument();
  });
});

describe("CogniMention node", () => {
  function createHeadlessEditor(content: string) {
    return new Editor({ extensions: createEditorExtensions(), content });
  }

  it("renders a mention as a link to the page's route", () => {
    const editor = createHeadlessEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "page-1", label: "Mitosis", notebookId: "nb-1" },
            },
          ],
        },
      ],
    } as unknown as string);
    try {
      const link = editor.view.dom.querySelector("a[data-type='mention']");
      expect(link?.getAttribute("href")).toBe("/notebooks/nb-1/pages/page-1");
      expect(link?.getAttribute("data-notebook-id")).toBe("nb-1");
      expect(link?.textContent).toBe("@Mitosis");
    } finally {
      editor.destroy();
    }
  });

  it("renders no href when the notebook is unknown (legacy mention)", () => {
    const editor = createHeadlessEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "page-1", label: "Mitosis" } },
          ],
        },
      ],
    } as unknown as string);
    try {
      const link = editor.view.dom.querySelector("a[data-type='mention']");
      expect(link?.hasAttribute("href")).toBe(false);
      expect(link?.hasAttribute("data-notebook-id")).toBe(false);
      expect(link?.textContent).toBe("@Mitosis");
    } finally {
      editor.destroy();
    }
  });

  it("parses notebookId from data-notebook-id", () => {
    const editor = createHeadlessEditor(
      '<p><span data-type="mention" data-id="page-1" data-label="Mitosis" data-notebook-id="nb-1">@Mitosis</span></p>',
    );
    try {
      const mention = editor.state.doc.firstChild?.firstChild;
      expect(mention?.type.name).toBe("mention");
      expect(mention?.attrs.notebookId).toBe("nb-1");
    } finally {
      editor.destroy();
    }
  });
});

// F5b (odd/tasks/review-followups.md): the node renders `a[data-type=mention]`
// but the stock parser only matches `span[data-type=mention]`, so a copied
// mention pasted back as plain text instead of a mention.
describe("mention HTML round-trip", () => {
  it("parses its own rendered anchor back into a mention node with its attributes", () => {
    const source = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "mention",
                attrs: { id: "page-1", label: "Mitosis", notebookId: "nb-1" },
              },
            ],
          },
        ],
      },
    });
    const html = source.getHTML();
    expect(html).toContain("<a ");
    expect(html).toContain('data-type="mention"');
    source.destroy();

    const target = new Editor({
      extensions: createEditorExtensions(),
      content: html,
    });
    const mention = target.state.doc.firstChild?.firstChild;

    expect(mention?.type.name).toBe("mention");
    expect(mention?.attrs).toMatchObject({
      id: "page-1",
      label: "Mitosis",
      notebookId: "nb-1",
    });
    target.destroy();
  });
});
