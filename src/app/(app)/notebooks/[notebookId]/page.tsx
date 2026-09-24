import { FileText, Notebook as NotebookIcon, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArchivePageButton,
  createPageAction,
  getNotebookForRoute,
} from "@/modules/notebooks";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { notebookToneFromColor } from "../../_components/notebook-swatches";

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

      <SectionHeader
        icon={
          <IconTile
            size="44"
            className="text-lg"
            tone={notebookToneFromColor(notebook.color)}
          >
            {notebook.icon ?? (
              <NotebookIcon aria-hidden="true" size={20} strokeWidth={1.75} />
            )}
          </IconTile>
        }
        eyebrow="Cuaderno"
        title={notebook.title}
        titleClassName="mt-0 text-xl"
        description={
          pages.length === 0
            ? "Aún no hay páginas. Crea la primera para empezar."
            : pages.length === 1
              ? "1 página"
              : `${pages.length} páginas`
        }
        descriptionClassName="mt-0.5"
        actions={
          <form action={createPage}>
            <button
              type="submit"
              className="flex h-10 items-center gap-1.5 rounded-input bg-neutral-900 px-4 text-[13.5px] text-white transition-all hover:bg-neutral-800"
            >
              <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
              Nueva página
            </button>
          </form>
        }
      />

      {pages.length === 0 ? (
        <EmptyState
          variant="dashed"
          fill
          icon={
            <IconTile size="56" tone="primary">
              <FileText aria-hidden="true" size={26} strokeWidth={1.5} />
            </IconTile>
          }
          title="Crea tu primera página"
          titleClassName="text-base"
          description="Cada página puede contener notas, imágenes, listas y más con autoguardado en segundos."
          descriptionClassName="max-w-sm"
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {pages.map((page) => (
            <li key={page.id} className="group relative">
              <Card
                asChild
                padding="sm"
                interactive
                className="flex items-center gap-3 rounded-[14px]"
              >
                <Link href={`/notebooks/${notebook.id}/pages/${page.id}`}>
                  <IconTile size="36" radius="input" tone="primary">
                    <FileText aria-hidden="true" size={18} strokeWidth={1.75} />
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[13.5px] text-fg">
                      {page.title}
                    </span>
                    <span className="block text-fg-muted text-xs">
                      Actualizada {UPDATED_AT_FORMAT.format(page.updatedAt)}
                    </span>
                  </span>
                </Link>
              </Card>
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
