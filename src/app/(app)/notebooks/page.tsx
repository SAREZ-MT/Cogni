import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import {
  CreateNotebookTrigger,
  getHomeOverview,
  NotebookCardActions,
} from "@/modules/notebooks";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { NotebookCover } from "@/shared/ui/notebook-cover";
import { NotebookCoverCard } from "@/shared/ui/notebook-cover-card";
import { NotebookFan } from "@/shared/ui/notebook-fan";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { formatTimeAgo } from "../_components/format";

// New screen (design pass 2, user decision "Cuadernos ... abre una nueva
// pantalla"): the full notebook library, replacing the sidebar's old
// compact tree. Header (Phase 8 H4-T4, user decision 2026-10-20): the violet
// notebook badge beside a gradient H1, like the Calendario header, and a
// tagline · count subtitle; no eyebrow and no create button — the empty
// state's CTA and the grid's tile create notebooks. Then the cover grid
// (H4-T5). H4-T6 (user decision 2026-10-29) dropped the grid/list view
// toggle: the hub has only the grid, so it reads no `?view=` param and an
// old `?view=list` URL renders the grid too.
export default async function NotebooksPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
    return;
  }

  const overview = await getHomeOverview();
  const now = new Date();
  const notebooks = overview.notebooks;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Cuadernos" }]} />

      <SectionHeader
        icon={<NotebookCover size="sm" />}
        leadingClassName="gap-4"
        title="Cuadernos"
        titleClassName="text-[32px] leading-tight tracking-tight text-gradient-brand"
        description={[
          "Tus materias, organizadas",
          notebooks.length === 0
            ? "Aún no tienes cuadernos"
            : notebooks.length === 1
              ? "1 cuaderno"
              : `${notebooks.length} cuadernos`,
        ]}
      />

      {notebooks.length === 0 ? (
        // Phase 8 H4-T1 (user-approved mockup 2026-10-20): an illustrated
        // invitation with three steps; its CTA opens the create dialog (the
        // only create control here since H4-T4 dropped the header's). H4-T2 (user decision
        // 2026-10-20): the calendar's glow on the dotted paper, entering as
        // a short cascade. H4-T3 (user decision 2026-10-20, option D
        // palette 1): a CSS fan of three notebooks replaces the
        // illustration.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          art={<NotebookFan />}
          title="Todas tus materias, en un solo lugar"
          description="Crea un cuaderno para cada materia o tema que estudies. Ahí se juntan tus apuntes, los que escribes y los que importas desde PDF, para que todo quede ordenado y a mano cuando lo necesites."
          steps={[
            "Crea un cuaderno por materia",
            "Escribe o importa tus apuntes",
            "Repasa con las técnicas",
          ]}
          action={
            <CreateNotebookTrigger
              variant="cta"
              label="Crear mi primer cuaderno"
            />
          }
        />
      ) : (
        // Phase 8 H4-T5 (user request 2026-10-28): each notebook is a
        // closed notebook like the empty state's fan, its colour on the
        // cover, the title in the middle. Columns follow the grid's own
        // width (the sidebar eats the viewport) and cap at five ("5 por
        // fila"): 5 at 1440 with the sidebar open, 4 at 1024, 2 on a
        // phone; wider screens grow the covers, never add columns.
        <div className="@container/grid">
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 @[300px]/grid:grid-cols-2 @[540px]/grid:grid-cols-3 @[680px]/grid:grid-cols-4 @[960px]/grid:grid-cols-5">
            {notebooks.map((notebook) => (
              <NotebookCoverCard
                key={notebook.id}
                href={`/notebooks/${notebook.id}`}
                title={notebook.title}
                pageCount={notebook.pageCount}
                dateLabel={formatTimeAgo(notebook.updatedAt, now)}
                tone={notebook.color}
                actions={<NotebookCardActions notebook={notebook} />}
              />
            ))}
            <CreateNotebookTrigger variant="tile" />
          </div>
        </div>
      )}
    </section>
  );
}
