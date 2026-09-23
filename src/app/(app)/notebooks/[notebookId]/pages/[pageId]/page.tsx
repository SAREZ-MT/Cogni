import { notFound } from "next/navigation";
import { Editor } from "@/modules/editor";
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
import { SetBreadcrumb } from "../../../../_components/breadcrumb";

// ADR 0002 (Vercel Fluid Compute, no worker, no Trigger.dev) + design.md,
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
  const notebookTitle = await getNotebookTitleForRoute(notebookId);
  const breadcrumbItems = notebookTitle
    ? [{ label: notebookTitle }, { label: page.title }]
    : [{ label: page.title }];

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

  return (
    // Reading measure (docs/design-system/screenshots/editor.png): the title
    // and the editor share one centered column instead of running the full
    // content width; the import cards use the same max-w-2xl.
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
      <SetBreadcrumb items={breadcrumbItems} />
      <h1 className="font-semibold text-fg text-xl">{page.title}</h1>
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
            <Editor
              pageId={page.id}
              initialContent={page.content}
              initialVersion={page.contentVersion}
              port={{ save: saveContent, getCurrent: getCurrentContent }}
              imagePort={{
                requestUpload: requestImageUpload,
                register: registerPageAsset,
                getReadUrl: getAssetReadUrl,
              }}
            />
          </div>
        }
      />
    </section>
  );
}
