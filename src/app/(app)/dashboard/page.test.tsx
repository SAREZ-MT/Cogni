import { render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptySources,
  sampleCalibration,
  sampleMetrics,
  sampleProgress,
} from "./_lib/dashboard-view.fixtures";

vi.mock("server-only", () => ({}));

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(
        children as ReactElement<{ width: number; height: number }>,
        { width: 800, height: 220 },
      ),
  };
});

const reads = vi.hoisted(() => ({
  progress: vi.fn(),
  metrics: vi.fn(),
  calibration: vi.fn(),
  zone: vi.fn(),
  user: vi.fn(),
}));

vi.mock("@/modules/analytics", () => ({
  // 13 Oct 2026 in any zone (the reads are faked).
  dayKeyFormatter: () => () => "2026-10-13",
  getDashboardProgress: reads.progress,
  getDashboardTechniqueMetrics: reads.metrics,
  getDashboardCalibration: reads.calibration,
}));
vi.mock("@/modules/identity", () => ({
  getCurrentTimeZoneSetting: reads.zone,
  getCurrentUser: reads.user,
}));

import DashboardPage from "./page";

function props(range?: string | string[]) {
  return {
    searchParams: Promise.resolve(range === undefined ? {} : { range }),
  };
}

const ok = <T,>(value: T) => ({ ok: true as const, value });

function withData() {
  reads.progress.mockResolvedValue(ok(sampleProgress()));
  reads.metrics.mockResolvedValue(ok(sampleMetrics()));
  reads.calibration.mockResolvedValue(ok(sampleCalibration()));
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reads.zone.mockResolvedValue({
      status: "ok",
      timeZone: "America/Bogota",
      chosen: true,
    });
    reads.user.mockResolvedValue({ id: "u-1", email: "ana@example.com" });
    withData();
  });

  it("renders every §3.6 section from the analytics reads", async () => {
    render(await DashboardPage(props()));

    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).toBeNull();
    for (const id of [
      "hero",
      "mastery-insight",
      "activity-chart",
      "accuracy-ring",
      "kpi-row",
      "notebook-progress",
      "calibration-table",
      "technique-activity",
    ]) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
    expect(screen.queryByTestId("concepts")).toBeNull();
    expect(screen.getByText("4 días")).toBeInTheDocument();
    expect(screen.getByTestId("hero")).toHaveTextContent(/, Ana/);
  });

  it("reads the selected range in the profile zone with one instant", async () => {
    render(await DashboardPage(props("15")));

    const range = {
      fromDay: "2026-09-29",
      toDay: "2026-10-14",
      timeZone: "America/Bogota",
    };
    expect(reads.metrics).toHaveBeenCalledWith({
      ...range,
      now: expect.any(Date),
    });
    expect(reads.calibration).toHaveBeenCalledWith(range);
    expect(reads.progress).toHaveBeenCalledWith({
      timeZone: "America/Bogota",
      weeks: 1,
      now: expect.any(Date),
    });
    expect(reads.progress.mock.calls[0]?.[0].now).toBe(
      reads.metrics.mock.calls[0]?.[0].now,
    );
  });

  it("shows one empty state to a user with no items and no reviews", async () => {
    const empty = emptySources();
    reads.progress.mockResolvedValue(ok(empty.progress));
    reads.metrics.mockResolvedValue(ok(empty.metrics));
    reads.calibration.mockResolvedValue(ok(empty.calibration));

    render(await DashboardPage(props()));

    expect(screen.getByTestId("dashboard-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Aún no hay progreso que mostrar"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ir a mis cuadernos/ }),
    ).toHaveAttribute("href", "/notebooks");
    expect(screen.queryByTestId("kpi-row")).toBeNull();
  });

  it.each([
    "progress",
    "metrics",
    "calibration",
  ] as const)("reports a failed %s read instead of showing made-up numbers", async (read) => {
    reads[read].mockResolvedValue({
      ok: false,
      error: { code: "ANALYTICS_UNEXPECTED", message: "x" },
    });

    render(await DashboardPage(props()));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar tus métricas",
    );
    expect(screen.queryByTestId("kpi-row")).toBeNull();
  });

  it("never shows a study-time metric", async () => {
    const { container } = render(await DashboardPage(props("30")));

    expect(container.textContent).not.toMatch(/tiempo de estudio/i);
    expect(screen.getAllByText("Repasos completados").length).toBeGreaterThan(
      0,
    );
  });

  it.each([
    [undefined, "los últimos 7 días", "7 días"],
    ["7", "los últimos 7 días", "7 días"],
    ["15", "los últimos 15 días", "15 días"],
    ["30", "los últimos 30 días", "30 días"],
    ["90", "los últimos 7 días", "7 días"],
    ["abc", "los últimos 7 días", "7 días"],
    [["15", "30"], "los últimos 15 días", "15 días"],
  ])("range %j selects %s", async (range, description, current) => {
    render(await DashboardPage(props(range)));

    expect(screen.getByText(`Cómo vas en ${description}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: current })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
