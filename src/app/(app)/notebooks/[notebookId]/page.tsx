import { FileText, Notebook as NotebookIcon, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArchivePageButton,
  createPageAction,
  getNotebookForRoute,
} from "@/modules/notebooks";
import { cn } from "@/shared/ui/utils";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import {
  NEUTRAL_SWATCH_CLASS,
  NOTEBOOK_SWATCH_CLASSES,
} from "../../_components/notebook-swatches";

interface NotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

const UPDATED_AT_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

// A foreign or archived notebookId renders as not-found, never leaking its
// title or pages (specs/notebooks/spec.md, "Ruta de página ajena"). Design
// pass 2 (user decision "el árbol de páginas del cuaderno vive aquí"):
// restyled after studyplatform-style-report.md §8 (workspace detail) — the
// notebook's own page tree, which used to render inside the sidebar, now
// lives on this route as a card grid.
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
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[{ label: "Cuadernos" }, { label: notebook.title }]}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-tile text-lg",
              notebook.color
                ? NOTEBOOK_SWATCH_CLASSES[notebook.color]
                : NEUTRAL_SWATCH_CLASS,
            )}
          >
            {notebook.icon ?? (
              <NotebookIcon aria-hidden="true" size={20} strokeWidth={1.75} />
            )}
          </span>
          <div>
            <p className="font-medium text-[11px] text-fg-muted uppercase tracking-wider">
              Cuaderno
            </p>
            <h1 className="font-bold text-fg text-xl">{notebook.title}</h1>
            <p className="mt-0.5 text-fg-muted text-sm">
              {pages.length === 0
                ? "Aún no hay páginas. Crea la primera para empezar."
                : pages.length === 1
                  ? "1 página"
                  : `${pages.length} páginas`}
            </p>
          </div>
        </div>
        <form action={createPage}>
          <button
            type="submit"
            className="flex h-10 items-center gap-1.5 rounded-input bg-neutral-900 px-4 text-[13.5px] text-white transition-all hover:bg-neutral-800"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
            Nueva página
          </button>
        </form>
      </div>

      {pages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[20px] border border-neutral-300 border-dashed px-14 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-tile bg-primary-100 text-primary-600">
            <FileText aria-hidden="true" size={26} strokeWidth={1.5} />
          </span>
          <h2 className="font-semibold text-base text-fg">
            Crea tu primera página
          </h2>
          <p className="max-w-sm text-fg-muted text-sm">
            Cada página puede contener notas, imágenes, listas y más con
            autoguardado en segundos.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {pages.map((page) => (
            <li key={page.id} className="group relative">
              <Link
                href={`/notebooks/${notebook.id}/pages/${page.id}`}
                className="flex items-center gap-3 rounded-[14px] border border-border-subtle bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-primary-100 text-primary-600">
                  <FileText aria-hidden="true" size={18} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[13.5px] text-fg">
                    {page.title}
                  </span>
                  <span className="block text-fg-muted text-xs">
                    Actualizada {UPDATED_AT_FORMAT.format(page.updatedAt)}
                  </span>
                </span>
              </Link>
              <ArchivePageButton
                pageId={page.id}
                title={page.title}
                className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
