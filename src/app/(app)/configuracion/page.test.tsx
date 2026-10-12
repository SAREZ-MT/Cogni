import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "../_components/breadcrumb";

const { getCurrentTimeZoneSetting } = vi.hoisted(() => ({
  getCurrentTimeZoneSetting: vi.fn(),
}));
vi.mock("@/modules/identity", () => ({ getCurrentTimeZoneSetting }));
vi.mock("@/modules/identity/actions", () => ({
  updateTimeZoneAction: vi.fn(),
  adoptBrowserTimeZoneAction: vi.fn(),
}));

import SettingsPage from "./page";

async function renderPage() {
  const element = (await SettingsPage()) as ReactElement;
  return render(
    <BreadcrumbProvider>
      {element}
      <Breadcrumb />
    </BreadcrumbProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    getCurrentTimeZoneSetting.mockReset();
    getCurrentTimeZoneSetting.mockResolvedValue({
      timeZone: "America/Bogota",
      chosen: true,
    });
  });

  it("titles the page Configuración and publishes it as the breadcrumb", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Configuración" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Configuración").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("shows one Zona horaria section with the stored zone selected", async () => {
    await renderPage();

    const card = screen.getByTestId("time-zone-card");
    expect(
      within(card).getByRole("heading", { level: 2, name: "Zona horaria" }),
    ).toBeInTheDocument();
    expect(within(card).getByLabelText("Zona horaria")).toHaveValue(
      "America/Bogota",
    );
    expect(
      within(card).getByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();
  });

  it("lists the runtime's IANA zones grouped by region, with the current offset", async () => {
    await renderPage();

    expect(screen.getByRole("group", { name: "Europa" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^Madrid \(GMT\+\d\)$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "UTC (GMT)" })).toHaveValue(
      "Etc/UTC",
    );
  });

  it("leaves the choice to the browser detection when no zone was chosen", async () => {
    getCurrentTimeZoneSetting.mockResolvedValue({
      timeZone: "UTC",
      chosen: false,
    });
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Unlisted/Zone",
    } as Intl.ResolvedDateTimeFormatOptions);

    await renderPage();

    expect(screen.getByLabelText("Zona horaria")).toHaveValue("");
    vi.restoreAllMocks();
  });
});
