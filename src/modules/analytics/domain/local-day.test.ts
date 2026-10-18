import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKeyFormatter,
  daysBetween,
  FIRST_ANALYTICS_DAY,
  isAnalyticsRange,
  isDayKey,
  isTimeZone,
  LAST_ANALYTICS_DAY,
  paddedWindow,
  startOfTomorrowIn,
  weekStartOf,
} from "./local-day";

describe("isDayKey", () => {
  it("accepts real ISO days", () => {
    expect(isDayKey("2026-10-13")).toBe(true);
    expect(isDayKey("2024-02-29")).toBe(true);
  });

  it("rejects malformed values and impossible dates", () => {
    expect(isDayKey("2026-2-1")).toBe(false);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey(20261013)).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });

  it("rejects a shape-valid key that rolls over past year 9999", () => {
    expect(isDayKey("9999-12-32")).toBe(false);
  });
});

describe("addDays", () => {
  it("moves across month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("throws rather than produce an expanded-year key", () => {
    expect(() => addDays("9999-12-31", 1)).toThrow(RangeError);
    expect(() => addDays("2026-10-13", Number.NaN)).toThrow(RangeError);
  });
});

describe("weekStartOf", () => {
  it("returns the Monday of the week holding the day", () => {
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(weekStartOf("2026-10-15")).toBe("2026-10-12"); // Thursday
    expect(weekStartOf("2026-10-18")).toBe("2026-10-12"); // Sunday
  });
});

describe("daysBetween", () => {
  it("lists every day of [fromDay, toDay)", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("is empty for an empty or inverted range", () => {
    expect(daysBetween("2026-10-13", "2026-10-13")).toEqual([]);
    expect(daysBetween("2026-10-14", "2026-10-13")).toEqual([]);
  });
});

describe("dayKeyFormatter", () => {
  it("formats an instant as its local day in the zone", () => {
    const instant = new Date("2026-10-13T03:30:00.000Z");
    expect(dayKeyFormatter("UTC")(instant)).toBe("2026-10-13");
    expect(dayKeyFormatter("America/Bogota")(instant)).toBe("2026-10-12");
    expect(dayKeyFormatter("Asia/Kathmandu")(instant)).toBe("2026-10-13");
  });
});

describe("paddedWindow", () => {
  it("pads the UTC midnights of the range by the widest offset (14 h)", () => {
    expect(paddedWindow("2026-10-12", "2026-10-19")).toEqual({
      from: new Date("2026-10-11T10:00:00.000Z"),
      to: new Date("2026-10-19T14:00:00.000Z"),
    });
  });
});

describe("isTimeZone", () => {
  it("accepts zones Intl can format in", () => {
    expect(isTimeZone("America/Bogota")).toBe(true);
    expect(isTimeZone("Etc/UTC")).toBe(true);
  });

  it("rejects unknown zones, blanks and non-strings", () => {
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone(5)).toBe(false);
  });
});

describe("isAnalyticsRange", () => {
  it("accepts a non-empty range of at most the maximum length", () => {
    expect(isAnalyticsRange("2026-10-06", "2026-10-13", 7)).toBe(true);
    expect(isAnalyticsRange("2026-10-06", "2026-10-07", 7)).toBe(true);
  });

  it("rejects empty, inverted and too long ranges", () => {
    expect(isAnalyticsRange("2026-10-13", "2026-10-13", 7)).toBe(false);
    expect(isAnalyticsRange("2026-10-14", "2026-10-13", 7)).toBe(false);
    expect(isAnalyticsRange("2026-10-05", "2026-10-13", 7)).toBe(false);
  });

  it("rejects malformed days", () => {
    expect(isAnalyticsRange("2026-10-6", "2026-10-13", 7)).toBe(false);
    expect(isAnalyticsRange("2026-10-06", "nope", 7)).toBe(false);
  });

  it("keeps both bounds inside the analytics window", () => {
    expect(
      isAnalyticsRange(FIRST_ANALYTICS_DAY, addDays(FIRST_ANALYTICS_DAY, 7), 7),
    ).toBe(true);
    expect(isAnalyticsRange("1969-12-31", "1970-01-02", 7)).toBe(false);
    expect(
      isAnalyticsRange(LAST_ANALYTICS_DAY, addDays(LAST_ANALYTICS_DAY, 1), 7),
    ).toBe(true);
    expect(
      isAnalyticsRange(
        addDays(LAST_ANALYTICS_DAY, 1),
        addDays(LAST_ANALYTICS_DAY, 2),
        7,
      ),
    ).toBe(false);
  });
});

// Reviews are due per local day (user decision 2026-10-18): "pending"
// counts every item due before the start of the owner's next local day.
describe("startOfTomorrowIn", () => {
  it("is the next local midnight in the zone", () => {
    // 22:00 on Monday 12 Oct in Bogotá (-05).
    expect(
      startOfTomorrowIn(new Date("2026-10-13T03:00:00.000Z"), "America/Bogota"),
    ).toEqual(new Date("2026-10-13T05:00:00.000Z"));
    expect(
      startOfTomorrowIn(new Date("2026-10-04T16:00:00.000Z"), "Asia/Tokyo"),
    ).toEqual(new Date("2026-10-05T15:00:00.000Z"));
  });

  it("is already tomorrow's start one millisecond before midnight", () => {
    expect(
      startOfTomorrowIn(new Date("2026-10-13T04:59:59.999Z"), "America/Bogota"),
    ).toEqual(new Date("2026-10-13T05:00:00.000Z"));
  });

  it("follows a 25-hour day when the clocks fall back", () => {
    // Madrid falls back on 25 Oct 2026: that day runs 22:00Z → 23:00Z.
    expect(
      startOfTomorrowIn(new Date("2026-10-25T10:00:00.000Z"), "Europe/Madrid"),
    ).toEqual(new Date("2026-10-25T23:00:00.000Z"));
  });

  it("starts tomorrow at the transition when its midnight is skipped", () => {
    // Santiago springs forward at 00:00 on 6 Sep 2026 (to 01:00, -03).
    expect(
      startOfTomorrowIn(
        new Date("2026-09-05T20:00:00.000Z"),
        "America/Santiago",
      ),
    ).toEqual(new Date("2026-09-06T04:00:00.000Z"));
  });
});
