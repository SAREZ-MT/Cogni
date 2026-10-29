import { Zap } from "lucide-react";
import Link from "next/link";
import {
  listRecallHubAction,
  type RecallHubPageView,
} from "@/modules/active-recall";
import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { IconTile } from "@/shared/ui/icon-tile";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { Pill } from "@/shared/ui/pill";
import { TechniqueEmptyArt } from "@/shared/ui/technique-empty-art";
import { TechniqueHubHeader } from "@/shared/ui/technique-hub-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { plural } from "../flashcards/_lib/plural";

const DEFAULT_TONE: NotebookColor = "purple";

function toTone(color: string | null): NotebookColor {
  return COLOR_PALETTE.find((candidate) => candidate === color) ?? DEFAULT_TONE;
}

interface NotebookEntry {
  notebook: { id: string; title: string; color: NotebookColor };
  pages: RecallHubPageView[];
}

// The notebooks holding recall pages, in the hub's order (notebook title,
// then page title).
function groupByNotebook(pages: readonly RecallHubPageView[]): NotebookEntry[] {
  const byNotebook = new Map<string, NotebookEntry>();
  for (const page of pages) {
    const entry = byNotebook.get(page.notebookId) ?? {
      notebook: {
        id: page.notebookId,
        title: page.notebookTitle,
        color: toTone(page.notebookColor),
      },
      pages: [],
    };
    entry.pages.push(page);
    byNotebook.set(page.notebookId, entry);
  }
  return [...byNotebook.values()];
}

// The percentage of the notebook's most recently finished session; 0 while
// that session is still being evaluated.
function latestPercentageOf(pages: readonly RecallHubPageView[]): number {
  let latest: RecallHubPageView["sessions"][number] | undefined;
  for (const page of pages) {
    const newest = page.sessions[0];
    if (newest && (!latest || newest.finishedAt > latest.finishedAt)) {
      latest = newest;
    }
  }
  return latest?.percentage ?? 0;
}

// Active recall hub on real data (Phase 6 T7, documento-maestro §3.3):
// every page with a finished session, grouped by notebook. The average
// mastery is study-engine's page mastery (decision in force), each notebook
// card badges its recall questions due today, and the quick start opens the first page with recall questions due today (the
// first page otherwise). The layout is the design preview's (Phase 6 UI
// freeze: the screens keep their look; the data adapts to them).
export default async function ActiveRecallHubPage() {
  const result = await listRecallHubAction();
  const hub = result.ok ? result.value : { pages: [], averageMastery: null };
  const notebooksWithPages = groupByNotebook(hub.pages);
  const allPages = hub.pages;

  const totalSessions = allPages.reduce(
    (sum, page) => sum + page.sessions.length,
    0,
  );
  const activeNotebookCount = notebooksWithPages.length;
  const averageMastery = hub.averageMastery ?? 0;

  const quickStartPage =
    allPages.find((page) => (page.dueToday ?? 0) > 0) ?? allPages[0];
  const quickStartHref = quickStartPage
    ? `/active-recall/${quickStartPage.notebookId}/${quickStartPage.pageId}`
    : undefined;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Recordación activa" }]} />

      <TechniqueHubHeader
        technique="recall"
        title="Recordación activa"
        description={`${plural(totalSessions, "sesión", "sesiones")} · ${plural(activeNotebookCount, "cuaderno", "cuadernos")}`}
        actions={
          quickStartHref && (
            <Link
              href={quickStartHref}
              className="flex items-center gap-2.5 rounded-[14px] bg-neutral-900 px-4 py-3 transition-transform hover:-translate-y-0.5"
            >
              <IconTile
                size="30"
                radius="md"
                className="bg-white/[12%] text-white"
              >
                <Zap aria-hidden="true" size={15} strokeWidth={2} />
              </IconTile>
              <span className="text-left">
                <span className="block font-semibold text-white text-xs">
                  Nueva sesión
                </span>
                <span className="block text-[10.5px] text-white/[55%]">
                  {plural(
                    allPages.length,
                    "página con preguntas",
                    "páginas con preguntas",
                  )}
                </span>
              </span>
            </Link>
          )
        }
      />

      {notebooksWithPages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill size="md" tone="success" dot>
            {totalSessions === 1
              ? "1 sesión guardada"
              : `${totalSessions} sesiones guardadas`}
          </Pill>
          <Pill size="md" tone="success" dot>
            {averageMastery} % dominio promedio
          </Pill>
          <Pill size="md" tone="neutral">
            {activeNotebookCount} cuaderno{activeNotebookCount === 1 ? "" : "s"}{" "}
            activo{activeNotebookCount === 1 ? "" : "s"}
          </Pill>
        </div>
      )}

      {notebooksWithPages.length === 0 ? (
        // Phase 8 H10 (user request 2026-10-29, explicit go-ahead past the
        // Phase 6 UI freeze for this empty state only): the notebooks hub's
        // empty-state line — stacked prompt cards on the dotted paper, a
        // cascade entrance, a gradient headline and the violet pill to the
        // notebooks, where a page's techniques panel creates the questions.
        // A failed read keeps the load error as the message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          technique="recall"
          art={<TechniqueEmptyArt technique="recall" />}
          title="Practica explicando con tus palabras"
          description={
            result.ok
              ? "Genera preguntas abiertas desde una página de tus cuadernos y respóndelas aquí."
              : "No pudimos cargar tus sesiones. Intenta de nuevo."
          }
          action={
            <EmptyStateCta href="/notebooks" tone="technique">
              Ir a mis cuadernos
            </EmptyStateCta>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {notebooksWithPages.map(({ notebook, pages }) => {
            const sessionCount = pages.reduce(
              (sum, page) => sum + page.sessions.length,
              0,
            );
            // The notebook's recall questions due today (user decision
            // 2026-10-08: the card's existing red due badge, as in the
            // flashcards hub); unknown counts show no badge.
            const dueCount = pages.reduce(
              (sum, page) => sum + (page.dueToday ?? 0),
              0,
            );

            return (
              <DeckSummaryCard
                key={notebook.id}
                href={`/active-recall/${notebook.id}`}
                tone={notebook.color}
                title={notebook.title}
                dueCount={dueCount}
                meta={`${plural(sessionCount, "sesión", "sesiones")} · último dominio ${latestPercentageOf(pages)} %`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
