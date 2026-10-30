import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EditorProps,
  MentionPort,
  SlashCommandItem,
} from "@/modules/editor";
// The editor's own slash filter, so the test types what a user types.
import { filterItemsFrom } from "@/modules/editor/ui/tiptap/slash-command";
import { PageEditor } from "./page-editor";
import { forgetSavedPages } from "./saved-pages";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { start } = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@/modules/ingestion/ui/document-import-provider", () => ({
  useDocumentImport: () => ({ start }),
}));

const { listPagesForMention } = vi.hoisted(() => ({
  listPagesForMention: vi.fn(),
}));
vi.mock("@/modules/notebooks/actions", () => ({ listPagesForMention }));

const { captured } = vi.hoisted(() => ({
  captured: {
    props: undefined as
      | (EditorProps & {
          mentionPort: MentionPort;
          extraSlashItems: SlashCommandItem[];
        })
      | undefined,
  },
}));
vi.mock("@/modules/editor", () => ({
  Editor: (props: typeof captured.props) => {
    captured.props = props;
    return <div data-testid="editor" />;
  },
}));

const pages = [
  { id: "1", title: "Mitosis", notebookId: "n1", notebookTitle: "Biología" },
  { id: "2", title: "Álgebra", notebookId: "n2", notebookTitle: "Mates" },
  { id: "3", title: "Celdas", notebookId: "n1", notebookTitle: "Biología" },
];

function mountEditor(notebookId = "n1") {
  render(
    <PageEditor
      notebookId={notebookId}
      pageId="p1"
      initialContent={{ type: "doc", content: [] }}
      initialVersion={1}
      port={{ save: vi.fn() } as unknown as EditorProps["port"]}
    />,
  );
  if (!captured.props) throw new Error("Editor not rendered");
  return captured.props;
}

describe("PageEditor", () => {
  beforeEach(() => {
    start.mockReset();
    listPagesForMention.mockReset();
    listPagesForMention.mockResolvedValue(pages);
    captured.props = undefined;
    refresh.mockReset();
    forgetSavedPages();
  });

  it("forwards the editor props untouched", () => {
    const props = mountEditor();
    expect(props.pageId).toBe("p1");
    expect(props.initialVersion).toBe(1);
  });

  // Phase 8 V9: browser back reuses the route's cached payload, which can
  // predate this session's saves.
  describe("returning to a page", () => {
    const saved = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "uno dos" }] },
      ],
    } as EditorProps["initialContent"];

    async function saveOnce() {
      const save = vi
        .fn()
        .mockResolvedValue({ ok: true, value: { version: 4 } });
      const { unmount } = render(
        <PageEditor
          notebookId="n1"
          pageId="p1"
          initialContent={{ type: "doc", content: [] }}
          initialVersion={1}
          port={{ save, getCurrent: vi.fn() } as unknown as EditorProps["port"]}
        />,
      );
      await captured.props?.port.save({
        pageId: "p1",
        content: saved,
        expectedVersion: 1,
      });
      unmount();
    }

    it("opens the last saved document, not an older payload, and refreshes the route", async () => {
      await saveOnce();
      const heard: unknown[] = [];
      const listener = (event: Event) =>
        heard.push((event as CustomEvent).detail);
      window.addEventListener("cogni:page-words", listener);

      const props = mountEditor();

      window.removeEventListener("cogni:page-words", listener);
      expect(props.initialContent).toEqual(saved);
      expect(props.initialVersion).toBe(4);
      expect(heard).toEqual([{ pageId: "p1", words: 2 }]);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("keeps a fresh payload and does not refresh", () => {
      const props = mountEditor();
      expect(props.initialContent).toEqual({ type: "doc", content: [] });
      expect(props.initialVersion).toBe(1);
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  // Phase 8 H14: each successful save tells the techniques panel the
  // page's current word count.
  describe("save port", () => {
    function mountWithSave(save: ReturnType<typeof vi.fn>) {
      render(
        <PageEditor
          notebookId="n1"
          pageId="p1"
          initialContent={{ type: "doc", content: [] }}
          initialVersion={1}
          port={{ save, getCurrent: vi.fn() } as unknown as EditorProps["port"]}
        />,
      );
      if (!captured.props) throw new Error("Editor not rendered");
      return captured.props.port;
    }
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "uno dos tres" }],
        },
      ],
    } as EditorProps["initialContent"];

    it("publishes the loaded page's words when it mounts", () => {
      const heard: unknown[] = [];
      const listener = (event: Event) =>
        heard.push((event as CustomEvent).detail);
      window.addEventListener("cogni:page-words", listener);
      render(
        <PageEditor
          notebookId="n1"
          pageId="p9"
          initialContent={doc}
          initialVersion={1}
          port={{ save: vi.fn() } as unknown as EditorProps["port"]}
        />,
      );

      window.removeEventListener("cogni:page-words", listener);
      expect(heard).toEqual([{ pageId: "p9", words: 3 }]);
    });

    it("publishes the saved page's words once the save succeeds", async () => {
      const save = vi
        .fn()
        .mockResolvedValue({ ok: true, value: { version: 2 } });
      const port = mountWithSave(save);
      const heard: unknown[] = [];
      const listener = (event: Event) =>
        heard.push((event as CustomEvent).detail);
      window.addEventListener("cogni:page-words", listener);

      const result = await port.save({
        pageId: "p1",
        content: doc,
        expectedVersion: 1,
      });

      window.removeEventListener("cogni:page-words", listener);
      expect(result).toEqual({ ok: true, value: { version: 2 } });
      expect(save).toHaveBeenCalledWith({
        pageId: "p1",
        content: doc,
        expectedVersion: 1,
      });
      expect(heard).toEqual([{ pageId: "p1", words: 3 }]);
    });

    it("publishes nothing when the save fails", async () => {
      const save = vi
        .fn()
        .mockResolvedValue({ ok: false, error: { code: "X", message: "x" } });
      const port = mountWithSave(save);
      const heard: unknown[] = [];
      const listener = (event: Event) => heard.push(event);
      window.addEventListener("cogni:page-words", listener);

      await port.save({ pageId: "p1", content: doc, expectedVersion: 1 });

      window.removeEventListener("cogni:page-words", listener);
      expect(heard).toEqual([]);
    });
  });

  describe("mention port", () => {
    it("returns every page for an empty query", async () => {
      const { mentionPort } = mountEditor();
      await expect(mentionPort.search("  ")).resolves.toEqual(pages);
    });

    it("filters by page or notebook title, case-insensitively", async () => {
      const { mentionPort } = mountEditor();
      await expect(mentionPort.search("MITO")).resolves.toEqual([pages[0]]);
      await expect(mentionPort.search("biolog")).resolves.toEqual([
        pages[0],
        pages[2],
      ]);
      await expect(mentionPort.search("zzz")).resolves.toEqual([]);
    });

    it("fetches the page list once and caches it across searches", async () => {
      const { mentionPort } = mountEditor();
      await mentionPort.search("a");
      await mentionPort.search("b");
      expect(listPagesForMention).toHaveBeenCalledTimes(1);
    });

    // F4c (odd/tasks/review-followups.md): a rejected lookup used to stay
    // cached, so every later "@" re-threw the same error until a reload.
    it("retries the lookup after a rejection instead of caching the failure", async () => {
      listPagesForMention.mockRejectedValueOnce(new Error("offline"));
      const { mentionPort } = mountEditor();

      await expect(mentionPort.search("")).rejects.toThrow("offline");
      await expect(mentionPort.search("")).resolves.toEqual(pages);

      expect(listPagesForMention).toHaveBeenCalledTimes(2);
    });

    it("shares one in-flight lookup between concurrent searches, then caches the success", async () => {
      const { mentionPort } = mountEditor();

      await Promise.all([mentionPort.search("a"), mentionPort.search("b")]);
      await mentionPort.search("c");

      expect(listPagesForMention).toHaveBeenCalledTimes(1);
    });

    it("caps the result list at 20 candidates", async () => {
      listPagesForMention.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => ({
          id: String(i),
          title: `Página ${i}`,
          notebookId: "n1",
          notebookTitle: "Cuaderno",
        })),
      );
      const { mentionPort } = mountEditor();
      await expect(mentionPort.search("")).resolves.toHaveLength(20);
    });
  });

  describe("Importar documento slash item", () => {
    it("is offered in the Contenido group for PDF, Word and PowerPoint documents", () => {
      const { extraSlashItems } = mountEditor();
      expect(extraSlashItems).toHaveLength(1);
      expect(extraSlashItems[0]).toMatchObject({
        id: "import-document",
        label: "Importar documento",
        description: "Importa un PDF, un Word o un PowerPoint en esta página",
        group: "Contenido",
      });
      expect(extraSlashItems[0].keywords).toEqual(
        expect.arrayContaining(["pdf", "word", "docx", "powerpoint", "pptx"]),
      );
    });

    it.each([
      "pdf",
      "word",
      "docx",
      "powerpoint",
      "pptx",
      "PowerPoint",
    ])("is found by typing /%s", (query) => {
      const { extraSlashItems } = mountEditor();
      expect(filterItemsFrom(extraSlashItems, query)).toEqual([
        extraSlashItems[0],
      ]);
    });

    it("removes the typed slash command and starts the import for this page's notebook", () => {
      const { extraSlashItems } = mountEditor("notebook-42");
      const run = vi.fn();
      const chain = {
        focus: vi.fn().mockReturnThis(),
        deleteRange: vi.fn().mockReturnThis(),
        run,
      };
      const editor = { chain: () => chain } as unknown as Parameters<
        SlashCommandItem["run"]
      >[0];
      const range = { from: 3, to: 9 };

      extraSlashItems[0].run(editor, range);

      expect(chain.deleteRange).toHaveBeenCalledWith(range);
      expect(run).toHaveBeenCalled();
      expect(start).toHaveBeenCalledExactlyOnceWith({
        notebookId: "notebook-42",
      });
    });
  });
});
