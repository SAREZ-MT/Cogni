import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/kernel/result";
import {
  ActiveImportsProvider,
  useActiveImportsActions,
  useIsImporting,
} from "./active-imports-provider";

const { getActiveImports } = vi.hoisted(() => ({
  getActiveImports: vi.fn(),
}));
vi.mock("../actions", () => ({ getActiveImports }));

function Probe({ pageId }: { pageId: string }) {
  const isImporting = useIsImporting(pageId);
  const { add, remove } = useActiveImportsActions();
  return (
    <div>
      <span data-testid={`status-${pageId}`}>
        {isImporting ? "importing" : "idle"}
      </span>
      <button type="button" onClick={() => add(pageId)}>
        add {pageId}
      </button>
      <button type="button" onClick={() => remove(pageId)}>
        remove {pageId}
      </button>
    </div>
  );
}

function renderWithProvider(
  initialPageIds: string[],
  children: ReactNode,
  client: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={client}>
      <ActiveImportsProvider initialPageIds={initialPageIds}>
        {children}
      </ActiveImportsProvider>
    </QueryClientProvider>,
  );
}

describe("ActiveImportsProvider / useIsImporting", () => {
  beforeEach(() => {
    getActiveImports.mockReset();
    getActiveImports.mockResolvedValue(ok([]));
  });

  it("reports the initial page ids as importing on first render", () => {
    renderWithProvider(["page-1"], <Probe pageId="page-1" />);

    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");
  });

  it("reports a page id not in the initial list as idle", () => {
    renderWithProvider(["page-1"], <Probe pageId="page-2" />);

    expect(screen.getByTestId("status-page-2")).toHaveTextContent("idle");
  });

  it("add() marks a page as importing immediately, without waiting for a poll", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProvider([], <Probe pageId="page-1" />);
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle");

    await user.click(screen.getByRole("button", { name: "add page-1" }));

    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");
  });

  it("add() is idempotent: calling it twice for the same page keeps a single entry", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProvider([], <Probe pageId="page-1" />);

    await user.click(screen.getByRole("button", { name: "add page-1" }));
    await user.click(screen.getByRole("button", { name: "add page-1" }));

    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");
  });

  it("remove() marks a page as idle immediately", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProvider(["page-1"], <Probe pageId="page-1" />);
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");

    await user.click(screen.getByRole("button", { name: "remove page-1" }));

    expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle");
  });

  it("polls getActiveImports every 2s while at least one page is active, and reflects a newly reported page", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getActiveImports.mockResolvedValue(ok(["page-1", "page-2"]));

    renderWithProvider(["page-1"], <Probe pageId="page-2" />);
    expect(screen.getByTestId("status-page-2")).toHaveTextContent("idle");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await waitFor(() =>
      expect(screen.getByTestId("status-page-2")).toHaveTextContent(
        "importing",
      ),
    );
    vi.useRealTimers();
  });

  it("keeps the last known list when a poll fails, instead of deriving idle from the error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getActiveImports
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "INGESTION_UNEXPECTED", message: "transient" },
      })
      .mockResolvedValue(ok(["page-1"]));

    renderWithProvider(["page-1"], <Probe pageId="page-1" />);
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");
    vi.useRealTimers();
  });

  it("stops polling once the list becomes empty", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getActiveImports.mockResolvedValue(ok([]));

    renderWithProvider(["page-1"], <Probe pageId="page-1" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() =>
      expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle"),
    );
    const callsAfterFirstPoll = getActiveImports.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(getActiveImports.mock.calls.length).toBe(callsAfterFirstPoll);
    vi.useRealTimers();
  });
});

describe("useIsImporting/useActiveImportsActions without a mounted provider", () => {
  it("reports idle and no-op add/remove so every consumer works standalone", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<Probe pageId="page-1" />);

    expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle");
    await expect(
      user.click(screen.getByRole("button", { name: "add page-1" })),
    ).resolves.not.toThrow();
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle");
    await expect(
      user.click(screen.getByRole("button", { name: "remove page-1" })),
    ).resolves.not.toThrow();
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle");
  });
});
