"use client";

// Composition-root wrapper around editor/ui/tiptap/editor.tsx's `Editor`
// (design.md, "notebooks como único puerto de persistencia hacia el
// editor"): editor/ui must never import `notebooks` or `ingestion`
// directly (cross-module-via-index + this module's own dependency-inversion
// convention — see editor/domain/mention-port.ts's header comment), so this
// route-local client component is where those two modules' hooks/actions
// get turned into the plain props/ports `Editor` accepts.
//
// - `mentionPort` (goal doc §2, "@" mentions): backed by notebooks'
//   `listPagesForMention` Server Action, fetched once and cached for the
//   life of this component (a failed fetch is never cached) — mentioning a page rarely needs live results,
//   and this avoids a network round-trip per keystroke after "@".
// - `extraSlashItems` (coordinator addition, "Importar documento" since
//   document-import T11): reuses ingestion's *existing* `useDocumentImport()`
//   hook (already mounted app-wide by layout.tsx's `NotebookActions` ->
//   `DocumentImportProvider`, independent of the sidebar tree — see
//   DocumentImportProvider's own header comment) and its existing picker
//   flow (PDF and Word): `start({ notebookId })` opens the same hidden file
//   input the notebook menu's "Importar documento" action uses,
//   uploads, creates a new page in this page's own notebook, and navigates
//   there. No upload logic is duplicated here.
import { FileUp } from "lucide-react";
import { useMemo, useRef } from "react";
import {
  Editor,
  type EditorProps,
  type MentionCandidate,
  type MentionPort,
  type SlashCommandItem,
} from "@/modules/editor";
// Deep import, not `@/modules/ingestion`'s public index.ts: useDocumentImport is
// a plain "use client" React context hook with no server dependency, and
// this route needs only it — same reasoning as notebook-actions.tsx's deep
// import of notebook-actions-slot.tsx.
import { useDocumentImport } from "@/modules/ingestion/ui/document-import-provider";
// Deep import, not `@/modules/notebooks`'s public index.ts — same
// "server-only" build-graph reasoning as page-title.tsx's own deep import
// (that barrel also re-exports `createNotebooksServerApi`, which pulls
// `notebooks/infrastructure` in). `listPagesForMention` itself carries
// Next's "use server" directive, so importing it directly from here is
// safe and standard — Next replaces it with a client-callable RPC stub
// instead of bundling its real implementation.
import { listPagesForMention } from "@/modules/notebooks/actions";

const MAX_MENTION_RESULTS = 20;

interface PageEditorProps extends EditorProps {
  notebookId: string;
}

export function PageEditor({ notebookId, ...editorProps }: PageEditorProps) {
  const { start } = useDocumentImport();
  const candidatesRef = useRef<Promise<MentionCandidate[]> | null>(null);

  const mentionPort: MentionPort = useMemo(
    () => ({
      async search(query) {
        if (!candidatesRef.current) {
          const lookup = listPagesForMention();
          candidatesRef.current = lookup;
          // A failed lookup must not stay cached: drop it (only if it is
          // still the cached one) so the next "@" tries again.
          lookup.catch(() => {
            if (candidatesRef.current === lookup) candidatesRef.current = null;
          });
        }
        const all = await candidatesRef.current;
        const normalized = query.trim().toLowerCase();
        const matches = normalized
          ? all.filter(
              (candidate) =>
                candidate.title.toLowerCase().includes(normalized) ||
                candidate.notebookTitle.toLowerCase().includes(normalized),
            )
          : all;
        return matches.slice(0, MAX_MENTION_RESULTS);
      },
    }),
    [],
  );

  const importDocumentItem: SlashCommandItem = useMemo(
    () => ({
      id: "import-document",
      label: "Importar documento",
      keywords: [
        "importar",
        "pdf",
        "word",
        "docx",
        "powerpoint",
        "pptx",
        "import",
        "documento",
      ],
      icon: FileUp,
      group: "Contenido",
      description: "Importa un PDF, un Word o un PowerPoint en esta página",
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        start({ notebookId });
      },
    }),
    [notebookId, start],
  );

  return (
    <Editor
      {...editorProps}
      mentionPort={mentionPort}
      extraSlashItems={[importDocumentItem]}
    />
  );
}
