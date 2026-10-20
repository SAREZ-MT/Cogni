import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { CreateNotebookTrigger, getHomeOverview } from "@/modules/notebooks";
import { Card } from "@/shared/ui/card";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { ViewToggle } from "@/shared/ui/view-toggle";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { NotebookCard } from "../_components/notebook-card";
import { NotebookListRow } from "../_components/notebook-list-row";
import { NOTEBOOKS_EMPTY_IMAGE } from "./_components/empty-image";

interface NotebooksPageProps {
  searchParams: Promise<{ view?: string }>;
}

// New screen (design pass 2, user decision "Cuadernos ... abre una nueva
// pantalla"): the full notebook library, replacing the sidebar's old
// compact tree. Header anatomy matches studyplatform-style-report.md §7
// (workspaces/page.tsx): bold H1, count subtitle, a primary create button
// (Phase 8 H4: no "Biblioteca" eyebrow since 2026-10-20), then a grid/list view toggle persisted in the
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
        title="Cuadernos"
        description={
          notebooks.length === 0
            ? "Aún no tienes cuadernos"
            : notebooks.length === 1
              ? "1 cuaderno"
              : `${notebooks.length} cuadernos`
        }
        actions={<CreateNotebookTrigger variant="pill" />}
      />

      {notebooks.length === 0 ? (
        // Phase 8 H4-T1 (user-approved mockup 2026-10-20): an illustrated
        // invitation with three steps; its CTA opens the same create dialog
        // as the header's "+ Nuevo cuaderno".
        <IllustratedEmptyState
          backdrop={false}
          image={NOTEBOOKS_EMPTY_IMAGE}
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
        <>
          <ViewToggle value={view} hrefFor={(v) => `/notebooks?view=${v}`} />

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
