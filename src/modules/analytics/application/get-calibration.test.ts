import { describe, expect, it } from "vitest";
// No `server-only` mock on purpose: get-calibration reaches active-recall's
// calibrationOf through its domain-only entry (active-recall/calibration.ts),
// never the index that also exports Server Actions, so loading it must not
// pull in any server-only module.
import { getCalibration } from "./get-calibration";
import { seededStore } from "./testing/seeded-store";

const RANGE = { fromDay: "2026-10-07", toDay: "2026-10-14" };

describe("getCalibration", () => {
  it("classifies each evaluated recall answer with the §7.4 rule and rolls it up per page", async () => {
    const store = seededStore();
    const answer = (
      pageId: string,
      selfRating: number,
      aiScore: number,
      iso: string,
    ) =>
      store.addRecallAnswer({
        pageId,
        selfRating,
        aiScore,
        status: "done",
        answeredAt: new Date(iso),
      });
    answer("p-1", 4, 2, "2026-10-08T10:00:00Z"); // overconfident
    answer("p-1", 3, 3, "2026-10-09T10:00:00Z"); // calibrated
    answer("p-2", 1, 4, "2026-10-10T10:00:00Z"); // underconfident
    // 14 Oct 02:00 UTC is still 13 Oct in Bogotá: inside the range.
    answer("p-2", 5, 5, "2026-10-14T02:00:00Z");
    // 7 Oct 03:00 UTC is 6 Oct in Bogotá: outside the range.
    answer("p-2", 5, 0, "2026-10-07T03:00:00Z");

    const calibration = await getCalibration(
      { ownerId: "owner-1", ...RANGE, timeZone: "America/Bogota" },
      { answers: store },
    );

    expect(calibration.totals).toEqual({
      answers: 4,
      overconfident: 1,
      underconfident: 1,
      calibrated: 2,
    });
    expect(calibration.pages).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        notebookTitle: "Biología",
        answers: 2,
        overconfident: 1,
        underconfident: 0,
        calibrated: 1,
        selfAverage: 3.5,
        aiAverage: 2.5,
      },
      {
        pageId: "p-2",
        pageTitle: "Ribosomas",
        notebookId: "nb-1",
        notebookTitle: "Biología",
        answers: 2,
        overconfident: 0,
        underconfident: 1,
        calibrated: 1,
        selfAverage: 3,
        aiAverage: 4.5,
      },
    ]);
  });

  it("leaves out an answer whose ratings the rule rejects", async () => {
    const store = seededStore();
    store.addRecallAnswer({
      pageId: "p-1",
      selfRating: 9,
      aiScore: 3,
      status: "done",
      answeredAt: new Date("2026-10-08T10:00:00Z"),
    });

    const calibration = await getCalibration(
      { ownerId: "owner-1", ...RANGE, timeZone: "UTC" },
      { answers: store },
    );

    expect(calibration.totals.answers).toBe(0);
  });
});
