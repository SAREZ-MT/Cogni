import { notFound } from "next/navigation";
import { getPageForRoute } from "@/modules/notebooks";

interface PagePageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// A foreign or archived pageId renders as not-found, never leaking its
// title or content (specs/notebooks/spec.md, "Ruta de página ajena"). The
// `<div data-testid="editor-mount">` below is a placeholder: the Tiptap
// editor and its real Server Action wiring land in PR3a/PR3b (design.md,
// "Editor — Tiptap base"); this slice only loads and shows title/content.
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
        <pre className="whitespace-pre-wrap text-fg-secondary text-sm">
          {JSON.stringify(page.content, null, 2)}
        </pre>
      </div>
    </section>
  );
}
