import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/kernel/result";
import type { ImportJobStatusView } from "../application";
import { INGESTION_COPY, pagesOmittedMessage } from "./ingestion-copy";
import { PageImportView } from "./page-import-view";

const { processPdfImport, getImportJobStatus } = vi.hoisted(() => ({
  processPdfImport: vi.fn(),
  getImportJobStatus: vi.fn(),
}));
vi.mock("../actions", () => ({ processPdfImport, getImportJobStatus }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

function job(
  overrides: Partial<ImportJobStatusView> = {},
): ImportJobStatusView {
  return {
    importJobId: "job-1",
    pageId: "page-1",
    status: "queued",
    pageCount: null,
    pagesWithoutText: 0,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderView(props: {
  initial: ImportJobStatusView | null;
  pageId?: string;
  editor?: ReactNode;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PageImportView
        initial={props.initial}
        pageId={props.pageId ?? "page-1"}
        editor={props.editor ?? <div data-testid="editor">editor content</div>}
      />
    </QueryClientProvider>,
  );
}

describe("PageImportView", () => {
  beforeEach(() => {
    processPdfImport.mockReset();
    getImportJobStatus.mockReset();
    refresh.mockReset();
    captureException.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the editor directly when there is no job", () => {
    renderView({ initial: null });

    expect(screen.getByTestId("page-import-view")).toHaveAttribute(
      "data-state",
      "no-job",
    );
    expect(screen.getByTestId("editor")).toBeInTheDocument();
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
    expect(processPdfImport).not.toHaveBeenCalled();
    expect(getImportJobStatus).not.toHaveBeenCalled();
  });

  it("calls processPdfImport once for a queued job, showing processing and never rendering the editor", async () => {
    let resolveCall: (value: unknown) => void = () => {};
    processPdfImport.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(processPdfImport).toHaveBeenCalledWith({ importJobId: "job-1" }),
    );
    expect(processPdfImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("page-import-view")).toHaveAttribute(
      "data-state",
      "processing",
    );
    expect(
      screen.getByText(INGESTION_COPY.progress.processing),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
    expect(getImportJobStatus).not.toHaveBeenCalled();

    resolveCall(ok(job({ status: "done" })));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("swaps in the editor and refreshes once when processPdfImport resolves done with no omissions", async () => {
    processPdfImport.mockResolvedValue(ok(job({ status: "done" })));

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(screen.getByTestId("editor")).toBeInTheDocument(),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-import-view")).toHaveAttribute(
      "data-state",
      "done",
    );
  });

  it("shows the skipped-pages notice above the editor when done with omissions", async () => {
    processPdfImport.mockResolvedValue(
      ok(job({ status: "done", pagesWithoutText: 2 })),
    );

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(screen.getByTestId("editor")).toBeInTheDocument(),
    );
    expect(screen.getByText(pagesOmittedMessage(2))).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the failed card above the (empty) editor when processPdfImport resolves failed", async () => {
    processPdfImport.mockResolvedValue(
      ok(job({ status: "failed", error: "no pudimos leer ese PDF." })),
    );

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(screen.getByTestId("editor")).toBeInTheDocument(),
    );
    expect(screen.getByText("no pudimos leer ese PDF.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("maps a processPdfImport Result error to a failed card, reports it to Sentry, still renders the editor", async () => {
    processPdfImport.mockResolvedValue({
      ok: false,
      error: { code: "IMPORT_JOB_NOT_FOUND", message: "not found" },
    });

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(screen.getByTestId("editor")).toBeInTheDocument(),
    );
    expect(screen.getByText(INGESTION_COPY.importNotFound)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("maps a thrown/rejected processPdfImport call to a failed card with the generic copy and reports it to Sentry", async () => {
    processPdfImport.mockRejectedValue(new Error("network down"));

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(screen.getByTestId("editor")).toBeInTheDocument(),
    );
    expect(screen.getByText(INGESTION_COPY.unexpected)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("renders an already-terminal initial job directly, without calling processPdfImport or refreshing", () => {
    renderView({ initial: job({ status: "done" }) });

    expect(screen.getByTestId("page-import-view")).toHaveAttribute(
      "data-state",
      "done",
    );
    expect(screen.getByTestId("editor")).toBeInTheDocument();
    expect(processPdfImport).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not update state after unmount once the in-flight processPdfImport call resolves", async () => {
    let resolveCall: (value: unknown) => void = () => {};
    processPdfImport.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const view = renderView({ initial: job({ status: "queued" }) });
    await waitFor(() => expect(processPdfImport).toHaveBeenCalled());

    view.unmount();
    resolveCall(ok(job({ status: "done" })));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not update state after unmount once the in-flight processPdfImport call rejects", async () => {
    let rejectCall: (error: unknown) => void = () => {};
    processPdfImport.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCall = reject;
      }),
    );

    const view = renderView({ initial: job({ status: "queued" }) });
    await waitFor(() => expect(processPdfImport).toHaveBeenCalled());

    view.unmount();
    rejectCall(new Error("network down"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(refresh).not.toHaveBeenCalled();
  });

  it("treats a query resolving with no job as a query failure and keeps polling", async () => {
    getImportJobStatus
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok(job({ status: "done" })));

    renderView({ initial: job({ status: "processing" }) });

    await waitFor(
      () => expect(screen.getByTestId("editor")).toBeInTheDocument(),
      {
        timeout: 5000,
      },
    );
  }, 10_000);

  it("moves to polling (never re-calling processPdfImport) when processPdfImport resolves still processing (claim race)", async () => {
    processPdfImport.mockResolvedValue(ok(job({ status: "processing" })));
    getImportJobStatus.mockResolvedValue(ok(job({ status: "processing" })));

    renderView({ initial: job({ status: "queued" }) });

    await waitFor(() =>
      expect(screen.getByTestId("page-import-view")).toHaveAttribute(
        "data-state",
        "polling",
      ),
    );
    expect(processPdfImport).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });

  it("polls getImportJobStatus for a reload while processing and swaps in the editor once it turns terminal", async () => {
    getImportJobStatus
      .mockResolvedValueOnce(ok(job({ status: "processing" })))
      .mockResolvedValueOnce(ok(job({ status: "done" })));

    renderView({ initial: job({ status: "processing" }) });

    expect(processPdfImport).not.toHaveBeenCalled();
    expect(screen.getByTestId("page-import-view")).toHaveAttribute(
      "data-state",
      "polling",
    );
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();

    await waitFor(
      () => expect(screen.getByTestId("editor")).toBeInTheDocument(),
      {
        timeout: 5000,
      },
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getImportJobStatus).toHaveBeenCalledWith({ pageId: "page-1" });
  }, 10_000);

  it("keeps the last known data and keeps polling when a query call fails (never derives a failed job state from it)", async () => {
    getImportJobStatus
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "INGESTION_UNEXPECTED", message: "transient" },
      })
      .mockResolvedValueOnce(ok(job({ status: "done" })));

    renderView({ initial: job({ status: "processing" }) });

    expect(screen.getByTestId("page-import-view")).toHaveAttribute(
      "data-state",
      "polling",
    );
    await waitFor(
      () => expect(screen.getByTestId("editor")).toBeInTheDocument(),
      {
        timeout: 5000,
      },
    );
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
  }, 10_000);

  it("stops polling on unmount", async () => {
    getImportJobStatus.mockResolvedValue(ok(job({ status: "processing" })));

    const view = renderView({ initial: job({ status: "processing" }) });
    await waitFor(() => expect(getImportJobStatus).toHaveBeenCalled());
    const callsBeforeUnmount = getImportJobStatus.mock.calls.length;

    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(getImportJobStatus.mock.calls.length).toBe(callsBeforeUnmount);
  }, 10_000);

  it("shows the slow-import notice after 90s and keeps polling", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getImportJobStatus.mockResolvedValue(ok(job({ status: "processing" })));

    renderView({ initial: job({ status: "processing" }) });

    await vi.advanceTimersByTimeAsync(90_000);

    expect(screen.getByText(INGESTION_COPY.progress.delay)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
