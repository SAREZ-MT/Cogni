import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getRecallPageSummaryAction } from "@/modules/active-recall";
import { getExamReviewNoticeAction } from "@/modules/exams";
import {
  type FlashcardView,
  getGenerationStatusAction,
  listFlashcardsAction,
} from "@/modules/flashcards";
import { getImportJobStatus, PageImportView } from "@/modules/ingestion";
import {
  getAssetReadUrl,
  getCurrentContent,
  getNotebookTitleForRoute,
  getPageForRoute,
  registerPageAsset,
  requestImageUpload,
  saveContent,
} from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import {
  PAGE_STATUS_SLOT_ID,
  PageHeader,
} from "../../../../_components/page-header";
import {
  TECHNIQUES_PANEL_COLLAPSED,
  TECHNIQUES_PANEL_COOKIE,
} from "../../../../_components/techniques-panel-cookie";
import { ExamReviewNotice } from "./_components/exam-review-notice";
import { PageEditor } from "./_components/page-editor";
import { PageTitle } from "./_components/page-title";
import { TechniquesPanel } from "./_components/techniques-panel";

// ADR 0003 (Vercel Fluid Compute, no worker, no Trigger.dev) + design.md,
// "Decision: Procesamiento síncrono en la Server Action con maxDuration":
// Next applies a Server Action's `maxDuration` from the page segment it is
// invoked from, not from the module that defines it. `processPdfImport`
// (ingestion/actions.ts) is only ever invoked from this route
// (`PageImportView`, T11), so this is the one segment whose ceiling must
// rise to cover download + extraction + conversion + persistence. Must
// stay a literal — route segment config has to be statically analyzable at
// build time, so it cannot reference `MAX_DURATION_S` directly — pinned
// equal to it by `max-duration.test.ts` instead. No other segment changes
// its `maxDuration`; `startPdfImport` is fast and keeps the platform
// default wherever it is invoked from.
export const maxDuration = 120;

interface PagePageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// A foreign or archived pageId renders as not-found, never leaking its
// title or content (specs/notebooks/spec.md, "Ruta de página ajena").
// This is the composition root design.md's "notebooks como único puerto de
// persistencia hacia el editor" describes: it is the only place that wires
// the real `saveContent`/`getCurrentContent` Server Actions into the
// `SavePagePort` shape and passes it down to the Tiptap-backed `Editor`.
export default async function PageView({ params }: PagePageProps) {
  const { notebookId, pageId } = await params;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();

  // S3 breadcrumb "{cuaderno} › {página}": a foreign/archived notebookId
  // (or any other lookup failure) degrades to just the page title rather
  // than blocking the route — getNotebookTitleForRoute never throws.
  // E1 (goal doc §1): PageTitle (the route's client wrapper) is now the
  // sole publisher of the breadcrumb trail, since it must live-update the
  // last segment as the title editor saves — see its own header comment.
  const notebookTitle = await getNotebookTitleForRoute(notebookId);

  // design.md, "Decision: Vista de página, llamada en curso y polling con
  // TanStack Query": this route fetches the job status once on the server
  // and hands it to PageImportView (T11), which owns calling
  // processPdfImport for a queued job or polling a processing one, and only
  // swaps in the editor once the job reaches a terminal state. The Editor
  // is passed as an element so ingestion never imports editor. A failed
  // lookup degrades to "no job" — getImportJobStatus never throws
  // (actions.ts's withBoundary) — rather than 500ing this route.
  const jobResult = await getImportJobStatus({ pageId: page.id });
  const initialJob = jobResult.ok ? jobResult.value : null;

  // Initial panel data (the "Técnicas de estudio" panel always shows its
  // three techniques on real data, Phase 6 T5b) is read here and refreshed
  // client-side after each generation. A failed read degrades to an empty
  // deck / no recall questions / unknown counter instead of blocking the
  // editor route.
  // Review before retaking (Phase 5 T8): a page waiting for an exam retake
  // lists the failed concepts above the editor. Derived from the page's
  // exam state on every visit (not from the results link's `?repaso`
  // query); a failed read shows no notice.
  const [cardsResult, statusResult, noticeResult, recallResult] =
    await Promise.all([
      listFlashcardsAction({ pageId: page.id }),
      getGenerationStatusAction().catch(() => null),
      getExamReviewNoticeAction({ pageId: page.id }).catch(() => null),
      getRecallPageSummaryAction({ pageId: page.id }).catch(() => null),
    ]);
  const initialRecallQuestionCount = recallResult?.ok
    ? recallResult.value.questionCount
    : 0;
  const reviewNotice = noticeResult?.ok ? noticeResult.value : null;
  const initialFlashcards: FlashcardView[] = cardsResult.ok
    ? cardsResult.value
    : [];
  const initialRemaining = statusResult?.ok
    ? statusResult.value.remainingToday
    : null;

  // design/shell-look: the "Técnicas" panel's collapsed state, read
  // server-side (same pattern as AppLayout's SIDEBAR_COOKIE) so
  // TechniquesPanel's first client render already matches the visitor's
  // last choice instead of always starting expanded.
  const cookieStore = await cookies();
  const techniquesPanelCollapsed =
    cookieStore.get(TECHNIQUES_PANEL_COOKIE)?.value ===
    TECHNIQUES_PANEL_COLLAPSED;

  return (
    <>
      {/* Reading measure (docs/design-system/screenshots/editor.png): the
          title and the editor share one centered column instead of running
          the full content width; the import cards use the same max-w-2xl. */}
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
        {/* S5/S7 (odd/tasks/app-shell-restyle.md), E1 (goal doc §1): title
            36px/700/1.1 (PageTitleEditor, live-editable) + meta row
            (screenshots/editor.png) with the last-edit time and the autosave
            status. The status itself still lives inside Editor's own top row
            and keeps its `autosave-status` testid and `aria-live`
            (notebooks-acceptance.spec.ts's `waitForSaved` / image-
            upload.spec.ts read it via `page.getByTestId(...)`, not scoped
            under `editor-mount`) — it is only portaled into this
            `statusSlot` visually, via the matching `statusPortalId` below. */}
        {/* Without a resolvable notebook (archived, foreign or a failed
            lookup) `/notebooks/{id}` would render not-found, so the link
            falls back to the notebooks list. */}
        <BackLink
          href={notebookTitle ? `/notebooks/${notebookId}` : "/notebooks"}
        >
          {notebookTitle ?? "Cuadernos"}
        </BackLink>
        <PageHeader
          titleSlot={
            <PageTitle
              pageId={page.id}
              notebookId={notebookId}
              initialTitle={page.title}
              notebookTitle={notebookTitle}
            />
          }
          updatedAt={page.updatedAt}
          statusSlot={<span id={PAGE_STATUS_SLOT_ID} />}
        />
        {reviewNotice && (
          <ExamReviewNotice
            failedConcepts={reviewNotice.failedConcepts}
            examHref={`/exams/${notebookId}/${page.id}`}
          />
        )}
        <PageImportView
          initial={initialJob}
          pageId={page.id}
          editor={
            <div
              data-testid="editor-mount"
              data-page-id={page.id}
              data-content-version={page.contentVersion}
              className="flex-1"
            >
              <PageEditor
                notebookId={notebookId}
                pageId={page.id}
                initialContent={page.content}
                initialVersion={page.contentVersion}
                port={{ save: saveContent, getCurrent: getCurrentContent }}
                imagePort={{
                  requestUpload: requestImageUpload,
                  register: registerPageAsset,
                  getReadUrl: getAssetReadUrl,
                }}
                statusPortalId={PAGE_STATUS_SLOT_ID}
              />
            </div>
          }
        />
      </section>
      <TechniquesPanel
        initialCollapsed={techniquesPanelCollapsed}
        notebookId={notebookId}
        pageId={page.id}
        initialFlashcards={initialFlashcards}
        initialRecallQuestionCount={initialRecallQuestionCount}
        initialRemaining={initialRemaining}
      />
    </>
  );
}
