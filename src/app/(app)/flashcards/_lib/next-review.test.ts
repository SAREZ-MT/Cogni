import { describe, expect, it } from "vitest";
import { daysUntil, nextReviewLabel } from "./next-review";

const ZONE = "America/Bogota";

// Phase 8 H17: an up-to-date deck says when its next review is, counted in
// calendar days of the student's time zone.
describe("next review", () => {
  const now = new Date("2026-10-29T22:00:00.000Z"); // 17:00 in Bogotá

  it("counts local calendar days, not 24-hour spans", () => {
    expect(daysUntil(new Date("2026-10-30T06:00:00.000Z"), now, ZONE)).toBe(1);
    expect(daysUntil(new Date("2026-10-30T04:00:00.000Z"), now, ZONE)).toBe(0);
    expect(daysUntil(new Date("2026-11-02T13:00:00.000Z"), now, ZONE)).toBe(4);
  });

  it("reads 'mañana' or 'en N días', and nothing without a scheduled review", () => {
    expect(nextReviewLabel("2026-10-30T15:00:00.000Z", now, ZONE)).toBe(
      "mañana",
    );
    expect(nextReviewLabel("2026-11-01T15:00:00.000Z", now, ZONE)).toBe(
      "en 3 días",
    );
    expect(nextReviewLabel(null, now, ZONE)).toBeNull();
  });

  it("reads 'mañana' for a review already due by the cutoff (never 'hoy' on an up-to-date deck)", () => {
    expect(nextReviewLabel("2026-10-29T23:00:00.000Z", now, ZONE)).toBe(
      "mañana",
    );
  });
});
