import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TIME_ZONE_COPY } from "./time-zone-copy";
import { TimeZoneForm } from "./time-zone-form";
import type { TimeZoneFormState } from "./time-zone-form-state";
import type { TimeZoneGroup } from "./time-zone-options";

const state = vi.hoisted(() => ({
  current: { status: "idle" } as TimeZoneFormState,
  pending: false,
}));

vi.mock("../actions", () => ({ updateTimeZoneAction: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [state.current, vi.fn(), state.pending],
  };
});

const GROUPS: TimeZoneGroup[] = [
  { label: "Universal", options: [{ value: "Etc/UTC", label: "UTC (GMT)" }] },
  {
    label: "América",
    options: [
      { value: "America/Bogota", label: "Bogota (GMT-5)" },
      { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
    ],
  },
];

function stubBrowserZone(timeZone: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone,
  } as Intl.ResolvedDateTimeFormatOptions);
}

afterEach(() => {
  vi.restoreAllMocks();
  state.current = { status: "idle" };
  state.pending = false;
});

describe("TimeZoneForm", () => {
  it("renders a labelled select grouped by region posting `timeZone`", () => {
    render(<TimeZoneForm groups={GROUPS} initialTimeZone="America/Bogota" />);

    const select = screen.getByLabelText(TIME_ZONE_COPY.fieldLabel);
    expect(select).toHaveAttribute("name", "timeZone");
    expect(select).toHaveValue("America/Bogota");
    expect(screen.getByRole("group", { name: "América" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Mexico City (GMT-6)" }),
    ).toBeInTheDocument();
  });

  it("preselects the browser zone when the profile has none yet", () => {
    stubBrowserZone("America/Mexico_City");

    render(<TimeZoneForm groups={GROUPS} initialTimeZone={null} />);

    expect(screen.getByLabelText(TIME_ZONE_COPY.fieldLabel)).toHaveValue(
      "America/Mexico_City",
    );
  });

  it("falls back to the placeholder when the browser zone is not listed", () => {
    stubBrowserZone("Asia/Kolkata");

    render(<TimeZoneForm groups={GROUPS} initialTimeZone={null} />);

    expect(screen.getByLabelText(TIME_ZONE_COPY.fieldLabel)).toHaveValue("");
    expect(
      screen.getByRole("option", { name: TIME_ZONE_COPY.placeholder }),
    ).toBeDisabled();
  });

  it("submits with the save button", () => {
    render(<TimeZoneForm groups={GROUPS} initialTimeZone="Etc/UTC" />);

    expect(
      screen.getByRole("button", { name: TIME_ZONE_COPY.save }),
    ).toHaveAttribute("type", "submit");
  });

  it("disables the button and says so while saving", () => {
    state.pending = true;

    render(<TimeZoneForm groups={GROUPS} initialTimeZone="Etc/UTC" />);

    expect(
      screen.getByRole("button", { name: TIME_ZONE_COPY.saving }),
    ).toBeDisabled();
  });

  it("announces a successful save politely", () => {
    state.current = {
      status: "success",
      message: TIME_ZONE_COPY.saved,
      timeZone: "America/Bogota",
    };

    render(<TimeZoneForm groups={GROUPS} initialTimeZone="Etc/UTC" />);

    expect(screen.getByRole("status")).toHaveTextContent(TIME_ZONE_COPY.saved);
  });

  it("shows the canonical stored zone after a successful save", () => {
    state.current = {
      status: "success",
      message: TIME_ZONE_COPY.saved,
      timeZone: "America/Mexico_City",
    };

    render(<TimeZoneForm groups={GROUPS} initialTimeZone="Etc/UTC" />);

    expect(screen.getByLabelText(TIME_ZONE_COPY.fieldLabel)).toHaveValue(
      "America/Mexico_City",
    );
  });

  it("announces an error as an alert", () => {
    state.current = { status: "error", message: TIME_ZONE_COPY.failed };

    render(<TimeZoneForm groups={GROUPS} initialTimeZone="Etc/UTC" />);

    expect(screen.getByRole("alert")).toHaveTextContent(TIME_ZONE_COPY.failed);
  });
});
