import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import type { MentionCandidate } from "../../domain/mention-port";
import { createEditorExtensions } from "./extensions";
import { createMentionSuggestion } from "./mention-node";

const candidate: MentionCandidate = {
  id: "page-1",
  title: "Mitosis",
  notebookId: "nb-1",
  notebookTitle: "Biología",
};

describe("createMentionSuggestion", () => {
  it("resolves an always-empty list when there is no port", async () => {
    const suggestion = createMentionSuggestion(null);
    await expect(suggestion.items({ query: "mi" })).resolves.toEqual([]);
  });

  it("maps port candidates to menu items (title as label, notebook as hint)", async () => {
    const search = vi.fn().mockResolvedValue([candidate]);
    const suggestion = createMentionSuggestion({ search });

    const items = await suggestion.items({ query: "mi" });

    expect(search).toHaveBeenCalledWith("mi");
    expect(items).toEqual([
      {
        id: "page-1",
        label: "Mitosis",
        description: "Biología",
        candidate,
      },
    ]);
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
      const mention = editor.getJSON().content?.[0]?.content?.[0];
      expect(mention?.type).toBe("mention");
      expect(mention?.attrs?.notebookId).toBe("nb-1");
    } finally {
      editor.destroy();
    }
  });
});
