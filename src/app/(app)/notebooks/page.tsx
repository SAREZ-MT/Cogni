import { LayoutGrid, List as ListIcon, NotebookPen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { CreateNotebookTrigger, getHomeOverview } from "@/modules/notebooks";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionHeader } from "@/shared/ui/section-header";
import { cn } from "@/shared/ui/utils";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { NotebookCard } from "../_components/notebook-card";
import { NotebookListRow } from "../_components/notebook-list-row";

interface NotebooksPageProps {
  searchParams: Promise<{ view?: string }>;
}

// New screen (design pass 2, user decision "Cuadernos ... abre una nueva
// pantalla"): the full notebook library, replacing the sidebar's old
// compact tree. Header anatomy matches studyplatform-style-report.md §7
// (workspaces/page.tsx): eyebrow "Biblioteca", bold H1, count subtitle, a
// primary create button, then a grid/list view toggle persisted in the
// `?view=` URL param (default grid) — a server-rendered toggle instead of
// client state, so the choice survives a full page reload and needs no JS.
export default async function NotebooksPage({
  searchParams,
}: NotebooksPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
    return;
  }

  const { view: viewParam } = await searchParams;
  const view = viewParam === "list" ? "list" : "grid";
  const overview = await getHomeOverview();
  const now = new Date();
  const notebooks = overview.notebooks;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Cuadernos" }]} />

      <SectionHeader
        eyebrow="Biblioteca"
        title="Cuadernos"
        description={
          notebooks.length === 0
            ? "Aún no tienes cuadernos. Crea uno para empezar."
            : notebooks.length === 1
              ? "1 cuaderno"
              : `${notebooks.length} cuadernos`
        }
        actions={<CreateNotebookTrigger variant="pill" />}
      />

      {notebooks.length === 0 ? (
        <EmptyState
          variant="dashed"
          fill
          icon={
            <IconTile size="56" tone="primary">
              <NotebookPen aria-hidden="true" size={26} strokeWidth={1.5} />
            </IconTile>
          }
          title="Crea tu primer cuaderno"
          titleClassName="text-base"
          description="Los cuadernos organizan tus apuntes por materia, semestre o proyecto."
          descriptionClassName="max-w-sm"
        />
      ) : (
        <>
          <div className="flex items-center gap-1 self-start rounded-input border border-border-subtle bg-neutral-100 p-1">
            <Link
              href="/notebooks?view=grid"
              aria-label="Ver como cuadrícula"
              aria-current={view === "grid" ? "true" : undefined}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors",
                view === "grid" && "bg-card text-fg shadow-xs",
              )}
            >
              <LayoutGrid aria-hidden="true" size={15} strokeWidth={1.75} />
            </Link>
            <Link
              href="/notebooks?view=list"
              aria-label="Ver como lista"
              aria-current={view === "list" ? "true" : undefined}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors",
                view === "list" && "bg-card text-fg shadow-xs",
              )}
            >
              <ListIcon aria-hidden="true" size={15} strokeWidth={1.75} />
            </Link>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {notebooks.map((notebook) => (
                <NotebookCard key={notebook.id} notebook={notebook} now={now} />
              ))}
              <CreateNotebookTrigger variant="tile" />
            </div>
          ) : (
            <Card>
              {notebooks.map((notebook) => (
                <NotebookListRow
                  key={notebook.id}
                  notebook={notebook}
                  now={now}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
