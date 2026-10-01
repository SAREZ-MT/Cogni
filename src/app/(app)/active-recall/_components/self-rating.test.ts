import { describe, expect, it } from "vitest";
import {
  SELF_RATING_BUCKET_META,
  SELF_RATING_BUCKET_ORDER,
  selfRatingBucketFor,
} from "./self-rating";

describe("selfRatingBucketFor", () => {
  it.each([
    [0, "dificil"],
    [1, "dificil"],
    [2, "regular"],
    [3, "regular"],
    [4, "facil"],
    [5, "facil"],
  ] as const)("buckets a self-rating of %i as %s", (rating, bucket) => {
    expect(selfRatingBucketFor(rating)).toBe(bucket);
  });
});

describe("self-rating bucket metadata", () => {
  it("orders the buckets from hardest to easiest", () => {
    expect(SELF_RATING_BUCKET_ORDER).toEqual(["dificil", "regular", "facil"]);
  });

  it("labels and tones every bucket error, warning, success", () => {
    expect(
      SELF_RATING_BUCKET_ORDER.map((bucket) => [
        SELF_RATING_BUCKET_META[bucket].label,
        SELF_RATING_BUCKET_META[bucket].pillTone,
      ]),
    ).toEqual([
      ["Difícil", "error"],
      ["Regular", "warning"],
      ["Fácil", "success"],
    ]);
  });

  it("keeps the dot and text colours in the same tone family as the pill", () => {
    for (const bucket of SELF_RATING_BUCKET_ORDER) {
      const meta = SELF_RATING_BUCKET_META[bucket];
      expect(meta.dotClassName).toContain(meta.pillTone);
      expect(meta.toneClassName).toContain(meta.pillTone);
    }
  });
});
