import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { emptyTechniqueSnapshot } from "../domain/technique-overview";
import type { TechniqueOverviewReader } from "../domain/technique-overview-reader";
import { getTechniqueOverview } from "./get-technique-overview";

function spyReader(): TechniqueOverviewReader & {
  readTechniqueSnapshot: ReturnType<typeof vi.fn>;
} {
  return {
    readTechniqueSnapshot: vi.fn(async () => emptyTechniqueSnapshot()),
  };
}

describe("getTechniqueOverview", () => {
  it("bounds today at the owner's local day: from its midnight to tomorrow's", async () => {
    const reader = spyReader();
    // 22:30 on Sunday 18 Oct in Bogotá (-05) is already Monday in UTC.
    const clock = createFixedClock(new Date("2026-10-19T03:30:00.000Z"));

    await getTechniqueOverview(
      { ownerId: "owner-1", timeZone: "America/Bogota" },
      { reader, clock },
    );

    expect(reader.readTechniqueSnapshot).toHaveBeenCalledWith("owner-1", {
      reviewedFrom: new Date("2026-10-18T05:00:00.000Z"),
      dueBefore: new Date("2026-10-19T05:00:00.000Z"),
    });
  });

  it("uses the zone's own day east of UTC", async () => {
    const reader = spyReader();
    // 23:30 UTC on 18 Oct is 08:30 on 19 Oct in Tokyo (+09).
    const clock = createFixedClock(new Date("2026-10-18T23:30:00.000Z"));

    await getTechniqueOverview(
      { ownerId: "owner-1", timeZone: "Asia/Tokyo" },
      { reader, clock },
    );

    expect(reader.readTechniqueSnapshot).toHaveBeenCalledWith("owner-1", {
      reviewedFrom: new Date("2026-10-18T15:00:00.000Z"),
      dueBefore: new Date("2026-10-19T15:00:00.000Z"),
    });
  });

  it("turns the reader's page ids into today's study units", async () => {
    const reader = spyReader();
    reader.readTechniqueSnapshot.mockResolvedValue({
      ...emptyTechniqueSnapshot(),
      flashcard: {
        total: 4,
        nextDueAt: new Date("2026-10-20T12:00:00Z"),
        duePageIds: ["p-1"],
        reviewedPageIds: ["p-1", "p-2"],
        completedPageIds: [],
      },
    });

    const overview = await getTechniqueOverview(
      { ownerId: "owner-1", timeZone: "UTC" },
      { reader, clock: createFixedClock(new Date("2026-10-18T10:00:00Z")) },
    );

    expect(overview.flashcard).toEqual({
      total: 4,
      nextDueAt: new Date("2026-10-20T12:00:00Z"),
      pendingUnits: 1,
      doneUnits: 1,
    });
  });
});
