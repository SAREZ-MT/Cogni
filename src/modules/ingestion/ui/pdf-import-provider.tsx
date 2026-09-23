"use client";

import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { requestPdfUpload, startPdfImport } from "../actions";
import { MAX_PDF_BYTES, PDF_MIME } from "../domain/pdf-file";
import { useActiveImportsActions } from "./active-imports-provider";
import { ImportProgress } from "./import-progress";
import { INGESTION_COPY, messageForIngestionErrorCode } from "./ingestion-copy";
import { uploadPdfToSignedUrl } from "./upload-pdf-to-signed-url";

// design.md, "Decision: Menú de acciones del cuaderno con slot inyectado
// desde la raíz de composición", step 3: this provider owns the single
// hidden `<input type="file">` for the whole app — Radix unmounts a
// DropdownMenu's content on close, so an input living inside the menu
// would lose its `change` event before the file was ever read. Only one
// import can run at a time (one hidden input, one banner state);
// `useNotebookImport(notebookId)` below derives each consumer's own view
// of it, reporting "busy" for every other notebook while one is active
// (T10 review follow-up: R3-provider-concurrent-imports-clobber-banner).
type BannerStatus = "uploading" | "queued" | "failed";
const ACTIVE_BANNER_STATUSES: readonly BannerStatus[] = ["uploading", "queued"];

interface BannerState {
  notebookId: string;
  status: BannerStatus;
  error?: string;
}

export interface NotebookImportState {
  status: "idle" | "busy" | BannerStatus;
  error?: string;
}

interface StartInput {
  notebookId: string;
  onPageCreated?: () => void;
}

interface PdfImportContextValue {
  start: (input: StartInput) => void;
  state: BannerState | null;
}

const IDLE_STATE: NotebookImportState = { status: "idle" };
const BUSY_STATE: NotebookImportState = { status: "busy" };

// Default value (no provider mounted): a no-op start and no banner, so
// every consumer (ImportPdfMenuItem, its tests) works standalone, the same
// default-context convention as notebooks/ui/notebook-actions-slot.tsx.
const PdfImportContext = createContext<PdfImportContextValue>({
  start: () => {},
  state: null,
});

export function usePdfImport(): { start: (input: StartInput) => void } {
  const { start } = useContext(PdfImportContext);
  return { start };
}

export function useNotebookImport(notebookId: string): NotebookImportState {
  const { state } = useContext(PdfImportContext);
  if (!state) return IDLE_STATE;
  if (state.notebookId === notebookId) {
    return { status: state.status, error: state.error };
  }
  return ACTIVE_BANNER_STATUSES.includes(state.status)
    ? BUSY_STATE
    : IDLE_STATE;
}

export function PdfImportProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const activeImports = useActiveImportsActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // `document.body` only exists after hydration; render the portal once
  // mounted so the server and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const pendingRef = useRef<StartInput | null>(null);
  const [state, setState] = useState<BannerState | null>(null);

  const start = useCallback(
    (input: StartInput) => {
      // One import at a time (T10 follow-up:
      // R3-provider-concurrent-imports-clobber-banner). ImportPdfMenuItem
      // already disables while busy; this guards a direct start() call
      // too (e.g. a second click before the disabled state re-renders).
      if (state && ACTIVE_BANNER_STATUSES.includes(state.status)) return;
      pendingRef.current = input;
      setState(null);
      // Null-guarded (T10 follow-up: R3-start-null-ref-cast). The hidden
      // <input> is portaled to document.body only once mounted (after
      // hydration); a start() call before that first effect runs must not
      // crash on a null ref.
      const element = fileInputRef.current;
      if (!element) return;
      // Allows re-selecting the exact same file twice in a row: the native
      // input only fires `change` when its value actually changes.
      element.value = "";
      element.click();
    },
    [state],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!file || !pending) return;
    const { notebookId, onPageCreated } = pending;

    // Client-side validation (design.md, "Mensajes de validación en el
    // cliente (antes de cualquier Server Action)"): never contacts the
    // server for a file that is already known to be rejected.
    if (file.type !== PDF_MIME) {
      setState({
        notebookId,
        status: "failed",
        error: INGESTION_COPY.invalidFileType,
      });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setState({
        notebookId,
        status: "failed",
        error: INGESTION_COPY.fileTooLarge,
      });
      return;
    }

    // T10 review follow-up (R3-provider-rejected-action-stuck-uploading):
    // a rejected Server Action call or a throwing upload helper must end
    // in `failed` with the generic copy and a Sentry report, never leave
    // the banner stuck in uploading/queued.
    try {
      setState({ notebookId, status: "uploading" });
      const grant = await requestPdfUpload({
        notebookId,
        fileName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      if (!grant.ok) {
        setState({
          notebookId,
          status: "failed",
          error: messageForIngestionErrorCode(grant.error.code),
        });
        return;
      }

      const uploaded = await uploadPdfToSignedUrl(
        grant.value.bucket,
        grant.value.storagePath,
        grant.value.token,
        file,
      );
      if (!uploaded.ok) {
        Sentry.captureException(uploaded.error);
        setState({
          notebookId,
          status: "failed",
          error: INGESTION_COPY.uploadFailed,
        });
        return;
      }

      setState({ notebookId, status: "queued" });
      const started = await startPdfImport({
        notebookId,
        storagePath: grant.value.storagePath,
        fileName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      if (!started.ok) {
        setState({
          notebookId,
          status: "failed",
          error: messageForIngestionErrorCode(started.error.code),
        });
        return;
      }

      // Success: clear the banner and hand off to the page (T11's
      // PageImportView takes over the progress display from here). T13a:
      // mark the new page as actively importing immediately so the
      // sidebar badge shows without waiting for the next
      // ActiveImportsProvider poll — safe since the job is already
      // persisted server-side by the time startPdfImport resolved.
      activeImports.add(started.value.pageId);
      setState(null);
      onPageCreated?.();
      router.push(`/notebooks/${notebookId}/pages/${started.value.pageId}`);
    } catch (error) {
      Sentry.captureException(error);
      setState({
        notebookId,
        status: "failed",
        error: INGESTION_COPY.unexpected,
      });
    }
  }

  return (
    <PdfImportContext.Provider value={{ start, state }}>
      {state && (
        <ImportProgress
          state={state.status}
          error={state.status === "failed" ? state.error : undefined}
        />
      )}
      {/*
        Portaled to <body> on purpose: the provider wraps the sidebar tree,
        and a hidden <input> inside the `<nav aria-label="Barra lateral">`
        would sit in the sidebar's DOM order (screen readers, and any
        `nav input` query such as the notebooks e2e rename step). The input
        is chrome for the whole app, not a sidebar control.
      */}
      {mounted &&
        createPortal(
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            hidden
            data-testid="pdf-import-input"
            onChange={(event) => {
              void handleFileChange(event);
            }}
          />,
          document.body,
        )}
      {children}
    </PdfImportContext.Provider>
  );
}
