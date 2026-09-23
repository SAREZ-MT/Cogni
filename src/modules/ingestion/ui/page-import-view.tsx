"use client";

import * as Sentry from "@sentry/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { getImportJobStatus, processPdfImport } from "../actions";
import type { ImportJobStatusView } from "../application";
import { useActiveImportsActions } from "./active-imports-provider";
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
  const activeImports = useActiveImportsActions();
  const [state, setState] = useState<ViewState>(() =>
    initialViewState(initial),
  );
  const [delayed, setDelayed] = useState(false);
  const [isRefreshPending, startRefreshTransition] = useTransition();
  // `initial` is stable for this component's instance: a reload or a fresh
  // navigation remounts PageImportView with new server-rendered props.
  const initialJobRef = useRef(initial);
  // T11 review follow-up (R3-strict-mode-double-process-call): guards the
  // queued -> processing-call effect below against React StrictMode's dev
  // double-invocation of effects (mount -> cleanup -> mount), which would
  // otherwise call processPdfImport twice for the same job. `startedRef`
  // persists across that double-invocation (same fiber) and is only ever
  // set once, unlike a local `cancelled` flag scoped to one effect
  // invocation. `mountedRef` is reset to true at the top of every
  // invocation (including StrictMode's synthetic remount) and only a real
  // unmount's cleanup is the last thing to run before the in-flight
  // promise resolves, so the callbacks below can still tell a genuine
  // unmount (mountedRef.current === false when they run) from StrictMode's
  // synthetic one (reset back to true by the immediate remount).
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  const isActive =
    state.phase === "processing-call" || state.phase === "polling";

  // T11 review follow-up (R3-editor-mounts-with-stale-content): the editor
  // must mount only once router.refresh()'s transition has actually
  // completed, so it renders with the refreshed initialContent/
  // initialVersion instead of the stale ones from before the import.
  // `remove()` fires immediately (optimistic sidebar badge update), not
  // gated on the transition.
  function finishTerminal(view: ImportJobStatusView): void {
    setState({ phase: "terminal", view });
    activeImports.remove(pageId);
    // `router.refresh()` is called from an async transition function (not
    // a plain synchronous callback) so React keeps `isRefreshPending` true
    // until the refresh actually settles, instead of a same-tick flip that
    // would defeat the point of gating the editor on it.
    startRefreshTransition(async () => {
      await router.refresh();
    });
  }

  // design.md: "llama processPdfImport({ importJobId }) una vez y la
  // espera; mientras tanto muestra processing desde su estado local y no
  // consulta por polling". Runs exactly once for a job that starts queued.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per mount for a queued job; state.phase is only read at that first render and finishTerminal is stable
  useEffect(() => {
    mountedRef.current = true;
    const job = initialJobRef.current;
    if (state.phase === "processing-call" && job && !startedRef.current) {
      startedRef.current = true;
      processPdfImport({ importJobId: job.importJobId })
        .then((result) => {
          if (!mountedRef.current) return;
          if (!result.ok) {
            // Deliverable: a Result error from processPdfImport is
            // reported to Sentry from the client too, not just
            // actions.ts's own withBoundary — this is the terminal signal
            // for the whole import flow, so a typed failure here is still
            // worth telemetry.
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
          if (!mountedRef.current) return;
          Sentry.captureException(error);
          finishTerminal(withError(job, INGESTION_COPY.unexpected));
        });
    }

    return () => {
      mountedRef.current = false;
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
      {(state.phase === "no-job" ||
        (state.phase === "terminal" && !isRefreshPending)) &&
        editor}
    </div>
  );
}
