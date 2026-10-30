import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  createPageAction,
  DeletePageButton,
  getNotebookForRoute,
} from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { PageSheet } from "@/shared/ui/page-sheet";
import { PageSheetCard } from "@/shared/ui/page-sheet-card";
import { PageSheetCreateTile } from "@/shared/ui/page-sheet-create-tile";
import { PageSheetFan } from "@/shared/ui/page-sheet-fan";
import { PageStripCreateRow } from "@/shared/ui/page-strip";
import { SectionHeader } from "@/shared/ui/section-header";
import { ViewToggle } from "@/shared/ui/view-toggle";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { formatUpdatedAt } from "../../_components/format";
import { PageListRow } from "../../_components/page-list-row";
import { NewPageDialog } from "./_components/new-page-dialog";

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

  // H5-T3 (user 2026-10-29): a blank page opens in its editor right away.
  // `redirect` throws, so nothing runs after it; the action's errors still
  // reach the route's error boundary, as before.
  async function createPage() {
    "use server";
    const created = await createPageAction({ notebookId });
    redirect(`/notebooks/${notebookId}/pages/${created.id}`);
  }

  // Every "Nueva página" opens the same "how to create" dialog (H5-T3).
  const newPage = (trigger: ReactNode) => (
    <NewPageDialog
      notebookId={notebook.id}
      createBlankPage={createPage}
      tone={tone}
      trigger={trigger}
    />
  );

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
              ? "Sin páginas todavía"
              : pages.length === 1
                ? "1 página"
                : `${pages.length} páginas`,
          ]}
        />
      </div>

      {pages.length === 0 ? (
        // Phase 8 H5-T4 (user request 2026-10-29): the hub's empty-state
        // line (H4-T1..T3) — a fan of page sheets in the notebook's colour
        // on the dotted paper, a cascade entrance, a gradient headline and
        // the hub's violet CTA, which opens the "Nueva página" dialog
        // (blank page or document import).
        <IllustratedEmptyState
          entrance="cascade"
          paper
          art={<PageSheetFan tone={tone} />}
          title="Tu cuaderno está listo para su primera página"
          description="Escribe tus apuntes desde cero o importa un PDF, Word o PowerPoint. Luego podrás repasarlos con las técnicas de estudio."
          action={newPage(
            <Button
              type="button"
              size="lg"
              className="rounded-pill bg-primary-600 px-6 font-semibold text-[15px] text-white shadow-[0_6px_18px_-6px_rgb(124_58_237/0.55)] hover:bg-primary-700"
            >
              Nueva página
            </Button>,
          )}
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
                  {newPage(
                    <PageSheetCreateTile
                      label="Nueva página"
                      hint={CREATE_HINT}
                    />,
                  )}
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
                        <DeletePageButton pageId={page.id} title={page.title} />
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* H5-T2: the list's first row creates a page too; each page
                  is a paper strip. */}
              {newPage(
                <PageStripCreateRow label="Nueva página" hint={CREATE_HINT} />,
              )}
              {pages.map((page) => (
                <PageListRow
                  key={page.id}
                  page={page}
                  notebookId={notebook.id}
                  tone={tone}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
