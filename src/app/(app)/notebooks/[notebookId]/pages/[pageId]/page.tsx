import { notFound } from "next/navigation";
import { Editor } from "@/modules/editor";
import {
  getCurrentContent,
  getPageForRoute,
  saveContent,
} from "@/modules/notebooks";

interface PagePageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// A foreign or archived pageId renders as not-found, never leaking its
// title or content (specs/notebooks/spec.md, "Ruta de página ajena").
// This is the composition root design.md's "notebooks como único puerto de
// persistencia hacia el editor" describes: it is the only place that wires
// the real `saveContent`/`getCurrentContent` Server Actions into the
// `SavePagePort` shape and passes it down to the Tiptap-backed `Editor`.
export default async function PageView({ params }: PagePageProps) {
  const { notebookId, pageId } = await params;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();

  return (
    <section className="flex flex-1 flex-col gap-4">
      <h1 className="font-semibold text-fg text-xl">{page.title}</h1>
      <div
        data-testid="editor-mount"
        data-page-id={page.id}
        data-content-version={page.contentVersion}
        className="flex-1"
      >
        <Editor
          pageId={page.id}
          initialContent={page.content}
          initialVersion={page.contentVersion}
          port={{ save: saveContent, getCurrent: getCurrentContent }}
        />
      </div>
    </section>
  );
}
