import { FileText, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import {
  ArchivePageButton,
  createPageAction,
  getNotebookForRoute,
} from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { PageSheet } from "@/shared/ui/page-sheet";
import { PageSheetCard } from "@/shared/ui/page-sheet-card";
import { PageSheetCreateTile } from "@/shared/ui/page-sheet-create-tile";
import { PageStripCreateRow } from "@/shared/ui/page-strip";
import { SectionHeader } from "@/shared/ui/section-header";
import { ViewToggle } from "@/shared/ui/view-toggle";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { formatUpdatedAt } from "../../_components/format";
import { PageListRow } from "../../_components/page-list-row";

const CREATE_HINT = "Escribe o importa un apunte";

interface NotebookPageProps {
  params: Promise<{ notebookId: string }>;
  searchParams: Promise<{ view?: string }>;
}

// A foreign or archived notebookId renders as not-found, never leaking its
// title or pages (specs/notebooks/spec.md, "Ruta de página ajena"). Design
// pass 2 (user decision "el árbol de páginas del cuaderno vive aquí"):
// restyled after studyplatform-style-report.md §8 (workspace detail) — the
// notebook's own page tree, which used to render inside the sidebar, now
// lives on this route as a card grid. Phase 8 H5-T1 (user request
// 2026-10-29): the hub's header line — a badge beside a gradient title, the
// eyebrow folded into the meta line — with a page-sheet badge in the
// notebook's colour (pages are this section), and each page as a sheet.
export default async function NotebookPage({
  params,
  searchParams,
}: NotebookPageProps) {
  const { notebookId } = await params;
  const routeView = await getNotebookForRoute(notebookId);
  if (!routeView) notFound();

  const { notebook, pages } = routeView;
  // Null (legacy notebooks) falls back to violet inside the atoms.
  const tone = notebook.color;
  const { view: viewParam } = await searchParams;
  const view = viewParam === "list" ? "list" : "grid";

  async function createPage() {
    "use server";
    await createPageAction({ notebookId });
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Cuadernos", href: "/notebooks" },
          { label: notebook.title },
        ]}
      />

      <div className="flex flex-col gap-3">
        <BackLink href="/notebooks">Cuadernos</BackLink>

        <SectionHeader
          icon={<PageSheet size="sm" tone={tone} />}
          leadingClassName="gap-4"
          title={notebook.title}
          titleClassName="text-[32px] leading-tight tracking-tight text-gradient-brand wrap-anywhere"
          description={[
            "Cuaderno",
            pages.length === 0
              ? "Aún no hay páginas. Crea la primera para empezar."
              : pages.length === 1
                ? "1 página"
                : `${pages.length} páginas`,
          ]}
        />
      </div>

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
          action={
            // The only create control while the notebook is empty (the
            // header lost its button in H5-T2); step 2 redesigns this state.
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
      ) : (
        <>
          <ViewToggle
            value={view}
            hrefFor={(v) => `/notebooks/${notebook.id}?view=${v}`}
          />

          {view === "grid" ? (
            // Phase 8 H5-T1 (user request 2026-10-29): each page is a paper
            // sheet in the hub covers' family, on the hub's grid — columns
            // follow the grid's own width (the sidebar eats the viewport)
            // and cap at five. H5-T2 (user 2026-10-29): the create tile is
            // always the first item, so many pages never push it down.
            <div className="@container/grid">
              <ul className="grid grid-cols-1 gap-x-6 gap-y-8 @[300px]/grid:grid-cols-2 @[540px]/grid:grid-cols-3 @[680px]/grid:grid-cols-4 @[960px]/grid:grid-cols-5">
                <li>
                  <form action={createPage} className="contents">
                    <PageSheetCreateTile
                      type="submit"
                      label="Nueva página"
                      hint={CREATE_HINT}
                    />
                  </form>
                </li>
                {pages.map((page) => (
                  <li key={page.id}>
                    <PageSheetCard
                      href={`/notebooks/${notebook.id}/pages/${page.id}`}
                      title={page.title}
                      datePrefix="Actualizada"
                      dateLabel={formatUpdatedAt(page.updatedAt)}
                      tone={tone}
                      actions={
                        <ArchivePageButton
                          pageId={page.id}
                          title={page.title}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* H5-T2: the list's first row creates a page too. */}
              <form action={createPage}>
                <PageStripCreateRow
                  type="submit"
                  label="Nueva página"
                  hint={CREATE_HINT}
                />
              </form>
              <Card>
                {pages.map((page) => (
                  <PageListRow
                    key={page.id}
                    page={page}
                    notebookId={notebook.id}
                  />
                ))}
              </Card>
            </div>
          )}
        </>
      )}
    </section>
  );
}
