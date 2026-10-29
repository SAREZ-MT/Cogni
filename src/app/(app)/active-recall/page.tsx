import {
  FileText,
  ListChecks,
  MessageCircleQuestion,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import {
  listRecallHubAction,
  type RecallHubPageView,
} from "@/modules/active-recall";
import {
  hubItemHref,
  notebookFilter,
  orderHubItems,
} from "@/shared/navigation/technique-hub";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { TechniqueEmptyArt } from "@/shared/ui/technique-empty-art";
import { TechniqueHubFilter } from "@/shared/ui/technique-hub-filter";
import { TechniqueHubHeader } from "@/shared/ui/technique-hub-header";
import {
  TechniqueItemCard,
  TechniqueItemPill,
} from "@/shared/ui/technique-item-card";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { loadCreateExamNotebooks } from "../exams/_lib/create-exam-notebooks";
import { CreateFromPageDialog } from "../flashcards/_components/create-from-page-dialog";
import { plural } from "../flashcards/_lib/plural";
import { readRemainingGenerations } from "../flashcards/_lib/remaining-generations";

// ADR 0003 (no queue): Next applies a Server Action's maxDuration from the
// page segment hosting it, and this hub's create dialog generates recall
// questions (Phase 8 H11) — the recall session route's budget.
export const maxDuration = 300;

const HUB = "/active-recall";

interface ActiveRecallHubPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

// The page's last activity: its newest finished session or question.
function recencyOf(page: RecallHubPageView): number {
  return Math.max(
    page.sessions[0] ? Date.parse(page.sessions[0].finishedAt) : 0,
    page.latestQuestionAt ? Date.parse(page.latestQuestionAt) : 0,
  );
}

// Active recall hub on real data, flat since Phase 8 H17 (user-approved
// mockups 2026-10-29; documento-maestro §3.3): every page with recall
// questions or a finished session is a TechniqueItemCard — "N preguntas",
// its finished sessions and study-engine page mastery (bar), or "Sin
// sesiones terminadas" — filtered by notebook with `?cuaderno=` on the
// server. Pages with questions due today come first (pill and filled
// "Practicar"), then never practised, then the most recent. "Practicar"
// opens the session from the hub (`?desde=hub`, keeping the filter). The
// average-mastery pills and the "Nueva sesión" quick start are gone: the
// cards carry that state. The first tile generates questions from a page
// (Phase 8 H11, AI only). Players untouched (Phase 6 UI freeze).
export default async function ActiveRecallHubPage({
  searchParams,
}: ActiveRecallHubPageProps = {}) {
  const params = (await searchParams) ?? {};
  const [result, createNotebooks, remaining] = await Promise.all([
    listRecallHubAction(),
    loadCreateExamNotebooks(),
    readRemainingGenerations(),
  ]);
  const createProps = {
    technique: "recall",
    notebooks: createNotebooks,
    remaining,
  } as const;
  const allPages = result.ok ? result.value.pages : [];

  const filter = notebookFilter(allPages, params.cuaderno, HUB);
  const ordered = orderHubItems(filter.visible, {
    pending: (page) => (page.dueToday ?? 0) > 0,
    neverPractised: (page) => page.sessions.length === 0,
    recency: recencyOf,
  });
  const totalSessions = allPages.reduce(
    (sum, page) => sum + page.sessions.length,
    0,
  );
  const notebookCount = filter.chips.length - 1;

  const card = (page: RecallHubPageView) => {
    const due = page.dueToday ?? 0;
    const sessions = page.sessions.length;
    const latest = page.sessions[0];
    const sessionHref = `/active-recall/${page.notebookId}/${page.pageId}`;
    return (
      <TechniqueItemCard
        key={page.pageId}
        technique="recall"
        href={hubItemHref(sessionHref, filter.selected)}
        notebook={{ title: page.notebookTitle, tone: page.notebookColor }}
        title={page.pageTitle}
        metric={{
          icon: MessageCircleQuestion,
          value: page.questionCount,
          unit: page.questionCount === 1 ? "pregunta" : "preguntas",
        }}
        status={
          sessions === 0 ? (
            <span>Sin sesiones terminadas</span>
          ) : (
            <>
              {due > 0 ? (
                <TechniqueItemPill>{due} para repasar</TechniqueItemPill>
              ) : null}
              <span>
                {plural(sessions, "sesión", "sesiones")}
                {page.mastery !== null ? (
                  <>
                    {" · dominio "}
                    <b className="font-semibold text-fg">{page.mastery} %</b>
                  </>
                ) : null}
              </span>
            </>
          )
        }
        progress={
          sessions > 0 && page.mastery !== null ? page.mastery : undefined
        }
        action={{ label: "Practicar" }}
        emphasis={due > 0 ? "primary" : "soft"}
        menu={
          <>
            <DropdownMenuItem asChild>
              <Link
                href={hubItemHref(`${sessionHref}/editar`, filter.selected)}
              >
                <Pencil aria-hidden="true" size={15} strokeWidth={1.75} />
                Editar preguntas
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/notebooks/${page.notebookId}/pages/${page.pageId}`}>
                <FileText aria-hidden="true" size={15} strokeWidth={1.75} />
                Abrir página
              </Link>
            </DropdownMenuItem>
            {latest ? (
              <DropdownMenuItem asChild>
                <Link href={`${sessionHref}/resultados?sesion=${latest.id}`}>
                  <ListChecks aria-hidden="true" size={15} strokeWidth={1.75} />
                  Ver último resultado
                </Link>
              </DropdownMenuItem>
            ) : null}
          </>
        }
      />
    );
  };

  return (
    <section
      data-technique-theme="recall"
      className="flex flex-1 flex-col gap-6"
    >
      <SetBreadcrumb items={[{ label: "Recordación activa" }]} />

      <TechniqueHubHeader
        technique="recall"
        title="Recordación activa"
        description={`${plural(totalSessions, "sesión", "sesiones")} · ${plural(allPages.length, "página", "páginas")} · ${plural(notebookCount, "cuaderno", "cuadernos")}`}
      />

      {allPages.length === 0 ? (
        // Phase 8 H10/H11 (explicit go-ahead past the Phase 6 UI freeze for
        // this empty state only): the illustrated empty state — the open
        // question and answer sheet on the emerald dotted paper, a cascade
        // entrance, the technique-gradient headline and the emerald CTA,
        // which opens the "pick a page" dialog (AI only). A failed read
        // keeps the load error as the message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          technique="recall"
          art={<TechniqueEmptyArt technique="recall" />}
          title="Practica explicando con tus palabras"
          description={
            result.ok
              ? "Elige una página de tus cuadernos: la IA crea preguntas abiertas y las respondes aquí."
              : "No pudimos cargar tus sesiones. Intenta de nuevo."
          }
          action={<CreateFromPageDialog {...createProps} trigger="cta" />}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <TechniqueHubFilter chips={filter.chips} />
          {ordered.length === 0 ? (
            <p className="text-fg-muted text-sm">
              Este cuaderno aún no tiene preguntas para practicar.
            </p>
          ) : null}
          <div className="@container">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3.5 @max-[520px]:grid-cols-1 @max-[520px]:gap-3">
              <CreateFromPageDialog {...createProps} trigger="tile" />
              {ordered.map(card)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
