"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/identity";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { createServerAnalytics } from "@/shared/observability/analytics";
import {
  getActiveImports as getActiveImportsUseCase,
  getImportJobStatus as getImportJobStatusUseCase,
  type ImportJobStatusView,
  type PdfUploadGrant,
  processImportJob as processImportJobUseCase,
  requestPdfUpload as requestPdfUploadUseCase,
  type StartPdfImportResult,
  startPdfImport as startPdfImportUseCase,
  toImportJobStatusView,
} from "./application";
import { INGESTION_ERROR } from "./domain/errors";
import {
  createDocumentExtractor,
  DrizzleImportJobRepository,
  ImportTelemetryAdapter,
  NotebooksPagesAdapter,
  SupabasePdfStorageGateway,
} from "./infrastructure";

// Server Actions are the only client-reachable entry point of this module
// (design.md, "ingestion/index.ts es la API pública ... ingestion/actions.ts
// es la raíz de composición"). Every one of them requires a session BEFORE
// calling into `application`, validates with Zod inside the use case, and
// maps every DomainError to the plain ActionError shape — same
// Result<T, ActionError> pattern as notebooks/actions.ts's
// requestImageUpload/registerPageAsset/getAssetReadUrl. None of these four
// actions ever throws to the client.
const SESSION_REQUIRED_MESSAGE = "Debes iniciar sesión para continuar.";

async function requireOwnerId(): Promise<Result<string, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return err(
      toActionError(
        new DomainError(
          INGESTION_ERROR.SESSION_REQUIRED,
          SESSION_REQUIRED_MESSAGE,
        ),
      ),
    );
  }
  return ok(user.id);
}

// Every adapter is constructed fresh per call, like
// notebooks/actions.ts's deps(): serverless functions are short-lived, so
// there is no shared-state cost to paying the constructor again, and it
// keeps this composition root free of module-level singletons that would
// outlive a single request in a shared runtime.
function deps() {
  const db = getDb();
  const env = serverEnv();
  const analytics = createServerAnalytics({
    key: env.NEXT_PUBLIC_POSTHOG_KEY,
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  return {
    notebookPages: new NotebooksPagesAdapter(db),
    storage: new SupabasePdfStorageGateway({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: env.SUPABASE_PDF_BUCKET,
    }),
    jobs: new DrizzleImportJobRepository(db),
    extractor: createDocumentExtractor(),
    telemetry: new ImportTelemetryAdapter(analytics),
    clock: systemClock,
  };
}

// The sidebar tree and the notebook/page routes both depend on the pages
// list; revalidating the layout segment keeps every Server Component
// consumer in sync after startPdfImport creates a page (same helper as
// notebooks/actions.ts's revalidateSidebar).
function revalidateSidebar(): void {
  revalidatePath("/", "layout");
}

const UNEXPECTED_ERROR: ActionError = {
  code: INGESTION_ERROR.UNEXPECTED,
  message: "unexpected ingestion action failure",
};

// design.md: "none of these four actions ever throws to the client". Every
// exported action below runs its body through this boundary so an
// unforeseen exception from a dependency (getCurrentUser, a use case, an
// adapter) degrades to a typed ActionError and a Sentry report instead of
// crashing the Server Action or leaking an unhandled rejection to the
// client (T8 review follow-up: R3-actions-never-throw-unenforced).
async function withBoundary<T>(
  run: () => Promise<Result<T, ActionError>>,
): Promise<Result<T, ActionError>> {
  try {
    return await run();
  } catch (error) {
    Sentry.captureException(error);
    return err(UNEXPECTED_ERROR);
  }
}

export async function requestPdfUpload(
  input: unknown,
): Promise<Result<PdfUploadGrant, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const { notebookPages, storage, clock } = deps();
    const result = await requestPdfUploadUseCase(
      input,
      { notebookPages, storage, clock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return result;
  });
}

// design.md, "Decision: Flujo de subida y procesamiento", step 3: fast, no
// download or extraction. Revalidates the sidebar so the notebook's new
// page shows up without a manual refresh.
export async function startPdfImport(
  input: unknown,
): Promise<Result<StartPdfImportResult, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const { notebookPages, storage, jobs, clock } = deps();
    const result = await startPdfImportUseCase(
      input,
      { notebookPages, storage, jobs, clock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateSidebar();
    return result;
  });
}

// design.md, "Decision: Procesamiento síncrono en la Server Action con
// maxDuration": long-running, only invoked from PageImportView (T11),
// bounded by the page segment's `maxDuration` (T8: page.tsx, 120 s). Maps
// the terminal ImportJob to the same read-only view getImportJobStatus
// returns.
export async function processPdfImport(
  input: unknown,
): Promise<Result<ImportJobStatusView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const { notebookPages, storage, jobs, extractor, telemetry, clock } =
      deps();
    const result = await processImportJobUseCase(
      input,
      { jobs, storage, extractor, notebookPages, telemetry, clock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(toImportJobStatusView(result.value));
  });
}

export async function getImportJobStatus(
  input: unknown,
): Promise<Result<ImportJobStatusView | null, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const { jobs, clock } = deps();
    const result = await getImportJobStatusUseCase(
      input,
      { jobs, clock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return result;
  });
}

// design.md, "Decision: Vista de página ...": page ids of the caller's
// active (queued/processing, non-abandoned) imports, for the sidebar's
// ImportingPageBadge (T13a). No input to validate; the use case itself has
// no error channel (see get-active-imports.ts), so any real failure here
// can only be a thrown exception, already caught by withBoundary below.
export async function getActiveImports(): Promise<
  Result<string[], ActionError>
> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const { jobs } = deps();
    const pageIds = await getActiveImportsUseCase({ jobs }, ownerId.value);
    return ok(pageIds);
  });
}
