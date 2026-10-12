import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/identity/ui", () => ({
  TimeZoneAutoDetect: () => <span data-testid="auto-detect" />,
}));
vi.mock("@/modules/identity", () => ({
  hasChosenTimeZone: (profile: { timezone: string }) =>
    profile.timezone !== "UTC",
}));

import { TimeZoneDetection } from "./time-zone-detection";

describe("TimeZoneDetection", () => {
  it("mounts the browser detection while the profile has no chosen zone", () => {
    render(<TimeZoneDetection profile={{ timezone: "UTC" }} />);

    expect(screen.getByTestId("auto-detect")).toBeInTheDocument();
  });

  it("stays out once a zone is chosen", () => {
    render(<TimeZoneDetection profile={{ timezone: "America/Bogota" }} />);

    expect(screen.queryByTestId("auto-detect")).not.toBeInTheDocument();
  });

  it("stays out when the profile could not be read", () => {
    render(<TimeZoneDetection profile={null} />);

    expect(screen.queryByTestId("auto-detect")).not.toBeInTheDocument();
  });
});
