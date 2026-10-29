import { ClipboardList, FileText, ListChecks, RotateCcw } from "lucide-react";
import Link from "next/link";
import { type ExamHubPageView, listExamHubAction } from "@/modules/exams";
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
import { plural } from "../flashcards/_lib/plural";
import { CreateExamDialog } from "./_components/create-exam-dialog";
import { loadCreateExamNotebooks } from "./_lib/create-exam-notebooks";

// ADR 0003 (no queue): Next applies a Server Action's maxDuration from the
// page segment hosting it, and "Crear examen" generates questions here —
// the exam page route's budget.
export const maxDuration = 120;

const HUB = "/exams";

interface ExamsHubPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

// The page's last activity: its last finished exam or newest question.
function recencyOf(page: ExamHubPageView): number {
  return Math.max(
    page.lastFinishedAt ? Date.parse(page.lastFinishedAt) : 0,
    page.latestQuestionAt ? Date.parse(page.latestQuestionAt) : 0,
  );
}

// Exams hub on real data, flat since Phase 8 H17 (user-approved mockups
// 2026-10-29; documento-maestro §3.3/§7.5): every page holding exam
// questions is a TechniqueItemCard — "N preguntas", then "Mejor nota X % ·
// último Y %" (bar on the best), "Sin intentos", or, with a retake
// pending, the "Repetir cuando estés listo" pill, the last attempt and a
// filled "Repetir examen" — filtered by notebook with `?cuaderno=` on the
// server. Retakes first, then never examined, then the most recent. The
// action opens the page's existing exam route, which picks N (10–30) on
// its start screen, offers the retake while one is pending, or resumes an
// open exam. The retake banner and the summary pills are gone: the cards
// carry that state. The first tile is "Crear examen" (Phase 8 H11).
export default async function ExamsHubPage({
  searchParams,
}: ExamsHubPageProps = {}) {
  const params = (await searchParams) ?? {};
  const [result, createExamNotebooks] = await Promise.all([
    listExamHubAction(),
    loadCreateExamNotebooks(),
  ]);
  // A failed read shows the load error in the empty state, never a false
  // "Aún no tienes exámenes".
  const allPages = result.ok ? result.value : [];

  const filter = notebookFilter(allPages, params.cuaderno, HUB);
  const ordered = orderHubItems(filter.visible, {
    pending: (page) => page.retakePending,
    neverPractised: (page) => page.attempts === 0,
    recency: recencyOf,
  });
  const examCount = allPages.reduce((sum, page) => sum + page.attempts, 0);
  const notebookCount = filter.chips.length - 1;

  const card = (page: ExamHubPageView) => {
    const examHref = `/exams/${page.notebookId}/${page.pageId}`;
    const examined = page.attempts > 0 && page.lastScore !== null;
    const retake = page.retakePending;
    return (
      <TechniqueItemCard
        key={page.pageId}
        technique="exams"
        href={hubItemHref(examHref, filter.selected)}
        notebook={{ title: page.notebookTitle, tone: page.notebookColor }}
        title={page.pageTitle}
        metric={{
          icon: ClipboardList,
          value: page.questionCount,
          unit: page.questionCount === 1 ? "pregunta" : "preguntas",
        }}
        status={
          retake ? (
            <>
              <TechniqueItemPill>Repetir cuando estés listo</TechniqueItemPill>
              {page.lastScore !== null ? (
                <span>
                  Último intento{" "}
                  <b className="font-semibold text-fg">{page.lastScore} %</b>
                </span>
              ) : null}
            </>
          ) : examined ? (
            <span>
              Mejor nota{" "}
              <b className="font-semibold text-fg">
                {page.bestScore ?? page.lastScore} %
              </b>
              {` · último ${page.lastScore} %`}
            </span>
          ) : (
            <span>Sin intentos</span>
          )
        }
        progress={
          retake
            ? (page.lastScore ?? undefined)
            : examined
              ? (page.bestScore ?? page.lastScore ?? undefined)
              : undefined
        }
        action={
          retake
            ? { label: "Repetir examen", icon: RotateCcw }
            : { label: "Hacer examen" }
        }
        emphasis={retake ? "primary" : "soft"}
        menu={
          <>
            <DropdownMenuItem asChild>
              <Link href={`${examHref}/preguntas`}>
                <ListChecks aria-hidden="true" size={15} strokeWidth={1.75} />
                Ver preguntas
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/notebooks/${page.notebookId}/pages/${page.pageId}`}>
                <FileText aria-hidden="true" size={15} strokeWidth={1.75} />
                Abrir página
              </Link>
            </DropdownMenuItem>
          </>
        }
      />
    );
  };

  return (
    <section
      data-technique-theme="exams"
      className="flex flex-1 flex-col gap-6"
    >
      <SetBreadcrumb items={[{ label: "Exámenes" }]} />

      <TechniqueHubHeader
        technique="exams"
        title="Exámenes"
        description={`${plural(examCount, "examen", "exámenes")} · ${plural(allPages.length, "página", "páginas")} · ${plural(notebookCount, "cuaderno", "cuadernos")}`}
      />

      {allPages.length === 0 ? (
        // Phase 8 H10/H11: the illustrated empty state — the test sheet on
        // the rose dotted paper, a cascade entrance, the technique-gradient
        // headline and the rose CTA, which opens "Crear examen" (its
        // no-notebooks state links to /notebooks). Since H13 the header has
        // no "Crear examen": the CTA here and the grid's first tile are the
        // create controls. A failed read keeps the load error as the
        // message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          technique="exams"
          art={<TechniqueEmptyArt technique="exams" />}
          title="Pon a prueba lo que sabes"
          description={
            result.ok
              ? "Elige una página y la IA crea un examen de opción múltiple desde su texto."
              : "No pudimos cargar tus exámenes. Intenta de nuevo."
          }
          action={
            <CreateExamDialog notebooks={createExamNotebooks} trigger="cta" />
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <TechniqueHubFilter chips={filter.chips} />
          {ordered.length === 0 ? (
            <p className="text-fg-muted text-sm">
              Este cuaderno aún no tiene exámenes.
            </p>
          ) : null}
          <div className="@container">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3.5 @max-[520px]:grid-cols-1 @max-[520px]:gap-3">
              <CreateExamDialog
                notebooks={createExamNotebooks}
                trigger="tile"
              />
              {ordered.map(card)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
