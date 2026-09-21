import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPageAction, getNotebookForRoute } from "@/modules/notebooks";

interface NotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// A foreign or archived notebookId renders as not-found, never leaking its
// title or pages (specs/notebooks/spec.md, "Ruta de página ajena").
export default async function NotebookPage({ params }: NotebookPageProps) {
  const { notebookId } = await params;
  const view = await getNotebookForRoute(notebookId);
  if (!view) notFound();

  const { notebook, pages } = view;

  async function createPage() {
    "use server";
    await createPageAction({ notebookId });
  }

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-fg text-xl">{notebook.title}</h1>
        <form action={createPage}>
          <button
            type="submit"
            className="flex h-9 items-center gap-1.5 rounded-input bg-primary px-3 text-primary-foreground text-sm"
          >
            <Plus aria-hidden="true" size={16} />
            Nueva página
          </button>
        </form>
      </div>

      {pages.length === 0 ? (
        <p className="text-fg-secondary text-sm">
          Este cuaderno todavía no tiene páginas. Crea una para empezar.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                href={`/notebooks/${notebook.id}/pages/${page.id}`}
                className="flex h-10 items-center gap-2 rounded-input px-3 text-fg text-sm hover:bg-active"
              >
                <FileText aria-hidden="true" size={16} strokeWidth={1.75} />
                {page.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
