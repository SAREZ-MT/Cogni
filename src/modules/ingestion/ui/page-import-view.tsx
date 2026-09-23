"use client";

import * as Sentry from "@sentry/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getImportJobStatus, processPdfImport } from "../actions";
import type { ImportJobStatusView } from "../application";
import { ImportProgress } from "./import-progress";
import { INGESTION_COPY, messageForIngestionErrorCode } from "./ingestion-copy";

// design.md, "Decision: Vista de página, llamada en curso y polling con
// TanStack Query".
const POLL_INTERVAL_MS = 2000;
const DELAY_NOTICE_MS = 90_000;

export interface PageImportViewProps {
  initial: ImportJobStatusView | null;
  pageId: string;
  editor: ReactNode;
}

// "processing-call": a queued job's single processPdfImport call is in
// flight, no polling. "polling": TanStack Query owns refetching a
// processing job. "terminal": done or failed, editor renders. "no-job": no
// import ever happened for this page.
type ViewState =
  | { phase: "no-job" }
  | { phase: "processing-call" }
  | { phase: "polling"; view: ImportJobStatusView }
  | { phase: "terminal"; view: ImportJobStatusView };

function isTerminalStatus(status: ImportJobStatusView["status"]): boolean {
  return status === "done" || status === "failed";
}

function initialViewState(initial: ImportJobStatusView | null): ViewState {
  if (!initial) return { phase: "no-job" };
  if (initial.status === "queued") return { phase: "processing-call" };
  if (isTerminalStatus(initial.status))
    return { phase: "terminal", view: initial };
  return { phase: "polling", view: initial };
}

function withError(
  base: ImportJobStatusView,
  error: string,
): ImportJobStatusView {
  return { ...base, status: "failed", error };
}

// design.md, "La ruta ... renderiza <PageImportView initial={view}
// editor={<Editor …/>} /> de @/modules/ingestion (el Editor se pasa como
// elemento, así ingestion no importa editor)". Owns the queued -> processing
// call, the processing -> polling reload path, and swapping the editor in
// only once the job reaches a terminal state.
export function PageImportView({
  initial,
  pageId,
  editor,
}: PageImportViewProps) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>(() =>
    initialViewState(initial),
  );
  const [delayed, setDelayed] = useState(false);
  // `initial` is stable for this component's instance: a reload or a fresh
  // navigation remounts PageImportView with new server-rendered props.
  const initialJobRef = useRef(initial);

  const isActive =
    state.phase === "processing-call" || state.phase === "polling";

  function finishTerminal(view: ImportJobStatusView): void {
    setState({ phase: "terminal", view });
    router.refresh();
  }

  // design.md: "llama processPdfImport({ importJobId }) una vez y la
  // espera; mientras tanto muestra processing desde su estado local y no
  // consulta por polling". Runs exactly once for a job that starts queued.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per mount for a queued job; state.phase is only read at that first render and finishTerminal is stable
  useEffect(() => {
    const job = initialJobRef.current;
    if (state.phase !== "processing-call" || !job) return;
    let cancelled = false;

    processPdfImport({ importJobId: job.importJobId })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          // Deliverable: a Result error from processPdfImport is reported
          // to Sentry from the client too, not just actions.ts's own
          // withBoundary — this is the terminal signal for the whole
          // import flow, so a typed failure here is still worth telemetry.
          Sentry.captureException(new Error(result.error.message));
          finishTerminal(
            withError(job, messageForIngestionErrorCode(result.error.code)),
          );
          return;
        }
        if (isTerminalStatus(result.value.status)) {
          finishTerminal(result.value);
        } else {
          // Another call already claimed the job (concurrent tabs); fall
          // back to polling instead of calling processPdfImport again.
          setState({ phase: "polling", view: result.value });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        Sentry.captureException(error);
        finishTerminal(withError(job, INGESTION_COPY.unexpected));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const query = useQuery({
    queryKey: ["ingestion", "page-import", pageId],
    queryFn: async () => {
      const result = await getImportJobStatus({ pageId });
      // A query failure (network, session hiccup) keeps the last known
      // data and is retried by the next interval — the job's error state
      // is never derived from a query failure (design.md).
      if (!result.ok || !result.value) {
        throw new Error(
          result.ok ? "import job disappeared" : result.error.message,
        );
      }
      return result.value;
    },
    initialData: state.phase === "polling" ? state.view : undefined,
    enabled: state.phase === "polling",
    refetchInterval: (activeQuery) =>
      isTerminalStatus(activeQuery.state.data?.status ?? "processing")
        ? false
        : POLL_INTERVAL_MS,
    retry: false,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: finishTerminal is stable for the component's lifetime (closes over router and setState only)
  useEffect(() => {
    if (state.phase !== "polling") return;
    const data = query.data;
    if (data && isTerminalStatus(data.status)) finishTerminal(data);
  }, [state.phase, query.data]);

  // design.md's 90s "tardando más de lo esperado" notice; keeps counting
  // across a processing-call -> polling handoff and clears once terminal.
  useEffect(() => {
    if (!isActive) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), DELAY_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [isActive]);

  const dataState =
    state.phase === "no-job"
      ? "no-job"
      : state.phase === "processing-call"
        ? "processing"
        : state.phase === "polling"
          ? "polling"
          : state.view.status;

  return (
    <div data-testid="page-import-view" data-state={dataState}>
      {isActive && (
        <div className="mx-auto w-full max-w-2xl">
          <ImportProgress state="processing" delayed={delayed} />
        </div>
      )}
      {state.phase === "terminal" && state.view.status === "failed" && (
        <div className="mx-auto w-full max-w-2xl">
          <ImportProgress state="failed" error={state.view.error} />
        </div>
      )}
      {state.phase === "terminal" &&
        state.view.status === "done" &&
        state.view.pagesWithoutText > 0 && (
          <div className="mx-auto w-full max-w-2xl">
            <ImportProgress
              state="done"
              pagesWithoutText={state.view.pagesWithoutText}
            />
          </div>
        )}
      {(state.phase === "no-job" || state.phase === "terminal") && editor}
    </div>
  );
}
