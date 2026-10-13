import { describe, expect, it } from "vitest";
import { timeZoneGroups } from "./time-zone-options";

// A fixed winter instant keeps the offsets deterministic (no DST in Bogota;
// Madrid on CET).
const NOW = new Date("2026-01-15T12:00:00.000Z");

const ZONES = [
  "Europe/Madrid",
  "America/Bogota",
  "America/Argentina/Buenos_Aires",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
  "America/Mexico_City",
];

describe("timeZoneGroups", () => {
  it("groups zones by region with Spanish labels, UTC first", () => {
    const groups = timeZoneGroups(ZONES, NOW);

    expect(groups.map((group) => group.label)).toEqual([
      "Universal",
      "América",
      "Asia",
      "Europa",
      "Pacífico",
    ]);
  });

  it("offers UTC as the explicit Etc/UTC choice", () => {
    const [universal] = timeZoneGroups(ZONES, NOW);

    expect(universal?.options).toEqual([
      { value: "Etc/UTC", label: "UTC (GMT+0)" },
    ]);
  });

  it("labels each zone by its city path and current offset, sorted by label", () => {
    const america = timeZoneGroups(ZONES, NOW).find(
      (group) => group.label === "América",
    );

    expect(america?.options).toEqual([
      {
        value: "America/Argentina/Buenos_Aires",
        label: "Argentina / Buenos Aires (GMT-3)",
      },
      { value: "America/Bogota", label: "Bogota (GMT-5)" },
      { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
    ]);
  });

  it("keeps a stored zone the list lacks so the select can show it", () => {
    const groups = timeZoneGroups(["America/Bogota"], NOW, "Asia/Kolkata");

    expect(
      groups.flatMap((group) => group.options).map((option) => option.value),
    ).toContain("Asia/Kolkata");
  });

  it("does not duplicate the unset default or Etc/UTC", () => {
    const values = timeZoneGroups(["UTC", "Etc/UTC", "Asia/Tokyo"], NOW, "UTC")
      .flatMap((group) => group.options)
      .map((option) => option.value);

    expect(values).toEqual(["Etc/UTC", "Asia/Tokyo"]);
  });
});
