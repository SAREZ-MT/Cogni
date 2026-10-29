import { describe, expect, it } from "vitest";
import { FROM_HUB_QUERY, fromHub, returnHref } from "./hub-return";

describe("hub return (Phase 8 H16)", () => {
  it("marks a route as opened from its technique hub", () => {
    expect(FROM_HUB_QUERY).toBe("desde=hub");
  });

  it("reads only the exact hub marker", () => {
    expect(fromHub("hub")).toBe(true);
    expect(fromHub(undefined)).toBe(false);
    expect(fromHub("")).toBe(false);
    expect(fromHub("https://evil.example")).toBe(false);
    expect(fromHub(["hub", "hub"])).toBe(false);
  });

  it("returns to the hub when opened from it, otherwise to the fallback", () => {
    expect(returnHref("hub", "/active-recall", "/active-recall/nb")).toBe(
      "/active-recall",
    );
    expect(returnHref(undefined, "/active-recall", "/active-recall/nb")).toBe(
      "/active-recall/nb",
    );
    expect(returnHref("/elsewhere", "/flashcards", "/flashcards/nb")).toBe(
      "/flashcards/nb",
    );
  });
});
