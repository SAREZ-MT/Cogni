import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import DashboardPage from "./page";

function props(range?: string | string[]) {
  return {
    searchParams: Promise.resolve(range === undefined ? {} : { range }),
  };
}

describe("DashboardPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("renders every §3.6 section while design previews are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await DashboardPage(props()));

    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vista previa")).toBeInTheDocument();
    for (const id of [
      "hero",
      "mastery-insight",
      "activity-chart",
      "accuracy-ring",
      "kpi-row",
      "notebook-progress",
      "calibration-table",
      "technique-activity",
      "concepts",
    ]) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers 404 in production before touching any sample data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(DashboardPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders in production when the preview opt-in is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "1");

    render(await DashboardPage(props()));

    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });

  it("never shows a study-time metric", async () => {
    vi.stubEnv("NODE_ENV", "development");

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
    vi.stubEnv("NODE_ENV", "development");

    render(await DashboardPage(props(range)));

    expect(screen.getByText(`Cómo vas en ${description}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: current })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
