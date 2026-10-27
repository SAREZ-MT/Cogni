import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EditorProps,
  MentionPort,
  SlashCommandItem,
} from "@/modules/editor";
import { PageEditor } from "./page-editor";

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
  });

  it("forwards the editor props untouched", () => {
    const props = mountEditor();
    expect(props.pageId).toBe("p1");
    expect(props.initialVersion).toBe(1);
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
    it("is offered in the Contenido group for PDF and Word documents", () => {
      const { extraSlashItems } = mountEditor();
      expect(extraSlashItems).toHaveLength(1);
      expect(extraSlashItems[0]).toMatchObject({
        id: "import-document",
        label: "Importar documento",
        description: "Importa un PDF, un Word o un PowerPoint en esta página",
        group: "Contenido",
      });
      expect(extraSlashItems[0].keywords).toEqual(
        expect.arrayContaining(["pdf", "word", "docx"]),
      );
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
