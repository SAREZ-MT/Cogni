import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/kernel/result";
import {
  ACTIVE_IMPORTS_QUERY_KEY,
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

  // Review follow-up from the T12+T13a slice
  // (R3-stale-closure-active-imports-mutations): `add`/`remove` used to
  // read `query.data` from the closure captured at the render that created
  // them. A consumer holding an older closure (bound before the cache was
  // refreshed by something else — a poll tick, another add()/remove())
  // would overwrite that other change with its own stale snapshot instead
  // of merging into the live cache.
  it("add()/remove() react to the live cache, not a stale render's snapshot", async () => {
    // `staleTime: Infinity` isolates this test from the provider's own
    // refetch-on-mount (staleTime 0 in production): without it, the
    // background fetch resolving with the default `ok([])` mock would
    // race the manual `setQueryData` calls below and silently undo them.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    type Actions = { add: (id: string) => void; remove: (id: string) => void };

    function StaleCapture({
      onCapture,
    }: {
      onCapture: (actions: Actions) => void;
    }) {
      const actions = useActiveImportsActions();
      // Captured once, at mount, and deliberately never refreshed — this
      // mirrors a handler bound to an early render's closure.
      const capturedRef = useRef(actions);
      // biome-ignore lint/correctness/useExhaustiveDependencies: fires once, at mount, to hand back the mount-time closure only — never the latest onCapture/actions.
      useEffect(() => {
        onCapture(capturedRef.current);
      }, []);
      return null;
    }

    let stale: Actions | null = null;

    renderWithProvider(
      ["page-1"],
      <>
        <Probe pageId="page-1" />
        <Probe pageId="page-2" />
        <Probe pageId="page-3" />
        <StaleCapture
          onCapture={(actions) => {
            stale = actions;
          }}
        />
      </>,
      client,
    );

    expect(stale).not.toBeNull();

    // Simulate a poll tick (or a concurrent add() from elsewhere) landing
    // page-2 directly in the cache, bypassing the stale closure entirely.
    act(() => {
      client.setQueryData(ACTIVE_IMPORTS_QUERY_KEY, ["page-1", "page-2"]);
    });
    await waitFor(() =>
      expect(screen.getByTestId("status-page-2")).toHaveTextContent(
        "importing",
      ),
    );

    // The stale add() must still merge into the CURRENT cache, not
    // overwrite it with the ["page-1"] snapshot it was created with.
    act(() => {
      stale?.add("page-3");
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-page-1")).toHaveTextContent(
        "importing",
      );
      expect(screen.getByTestId("status-page-2")).toHaveTextContent(
        "importing",
      );
      expect(screen.getByTestId("status-page-3")).toHaveTextContent(
        "importing",
      );
    });
  });

  // Review follow-up from the T12+T13a slice
  // (R3-no-test-polling-restarts-after-add): `refetchInterval` returns
  // `false` while the cached list is empty, so nothing polled it back on.
  // add() on an empty list must make TanStack Query re-evaluate
  // `refetchInterval` against the new non-empty data and restart polling.
  it("add() on an empty list restarts the 2s polling", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Stays empty throughout: this isolates the assertion to whether
    // `refetchInterval` gets re-evaluated after add(), not to what a poll
    // would report back.
    getActiveImports.mockResolvedValue(ok([]));

    renderWithProvider([], <Probe pageId="page-1" />);
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("idle");

    // The initial mount always runs the queryFn once regardless of
    // `refetchInterval`; let it settle before taking the "empty" baseline.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const callsWhileEmpty = getActiveImports.mock.calls.length;

    // Nothing is importing: an elapsed interval must not poll further.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(getActiveImports.mock.calls.length).toBe(callsWhileEmpty);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "add page-1" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("status-page-1")).toHaveTextContent("importing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getActiveImports.mock.calls.length).toBeGreaterThan(callsWhileEmpty);

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
