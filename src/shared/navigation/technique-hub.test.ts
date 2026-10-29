import { describe, expect, it } from "vitest";
import {
  hubHref,
  hubItemHref,
  hubReturnHref,
  notebookFilter,
  orderHubItems,
} from "./technique-hub";

const NB_A = "11111111-1111-4111-8111-111111111111";
const NB_B = "22222222-2222-4222-8222-222222222222";

function item(id: string, notebookId: string, notebookTitle: string) {
  return { id, notebookId, notebookTitle, notebookColor: "yellow" };
}

// Phase 8 H17 (user-approved flat hubs, 2026-10-29): the hubs list every
// item at once, filtered by notebook through `?cuaderno=`.
describe("notebookFilter", () => {
  const items = [
    item("p1", NB_B, "Cuaderno B"),
    item("p2", NB_A, "Cuaderno A"),
    item("p3", NB_B, "Cuaderno B"),
  ];

  it("offers 'Todos' plus one chip per notebook, by title, each with its count and link", () => {
    const filter = notebookFilter(items, undefined, "/flashcards");

    expect(filter.chips).toEqual([
      {
        key: "all",
        label: "Todos",
        count: 3,
        href: "/flashcards",
        active: true,
        tone: null,
      },
      {
        key: NB_A,
        label: "Cuaderno A",
        count: 1,
        href: `/flashcards?cuaderno=${NB_A}`,
        active: false,
        tone: "yellow",
      },
      {
        key: NB_B,
        label: "Cuaderno B",
        count: 2,
        href: `/flashcards?cuaderno=${NB_B}`,
        active: false,
        tone: "yellow",
      },
    ]);
    expect(filter.selected).toBeNull();
    expect(filter.visible).toEqual(items);
  });

  it("keeps only the chosen notebook's items and marks its chip active", () => {
    const filter = notebookFilter(items, NB_B, "/exams");

    expect(filter.selected).toBe(NB_B);
    expect(filter.visible.map((entry) => entry.id)).toEqual(["p1", "p3"]);
    expect(filter.chips.find((chip) => chip.active)?.key).toBe(NB_B);
  });

  it("shows nothing for a notebook without items, with no chip active", () => {
    const filter = notebookFilter(items, NB_A.replace("1", "9"), "/exams");

    expect(filter.visible).toEqual([]);
    expect(filter.chips.some((chip) => chip.active)).toBe(false);
  });

  it("ignores a repeated or empty parameter", () => {
    expect(notebookFilter(items, [NB_A, NB_B], "/exams").selected).toBeNull();
    expect(notebookFilter(items, "", "/exams").selected).toBeNull();
  });
});

describe("orderHubItems", () => {
  it("puts pending items first, then never practised, then the most recent", () => {
    const rows = [
      { id: "old", pending: false, never: false, at: 1 },
      { id: "new", pending: false, never: false, at: 5 },
      { id: "fresh", pending: false, never: true, at: 2 },
      { id: "due-old", pending: true, never: false, at: 1 },
      { id: "due-new", pending: true, never: false, at: 9 },
    ];

    const ordered = orderHubItems(rows, {
      pending: (row) => row.pending,
      neverPractised: (row) => row.never,
      recency: (row) => row.at,
    });

    expect(ordered.map((row) => row.id)).toEqual([
      "due-new",
      "due-old",
      "fresh",
      "new",
      "old",
    ]);
  });

  it("does not reorder the input array", () => {
    const rows = [{ at: 1 }, { at: 2 }];
    orderHubItems(rows, {
      pending: () => false,
      neverPractised: () => false,
      recency: (row) => row.at,
    });
    expect(rows).toEqual([{ at: 1 }, { at: 2 }]);
  });
});

describe("hub links", () => {
  it("links the hub, filtered or not", () => {
    expect(hubHref("/flashcards", null)).toBe("/flashcards");
    expect(hubHref("/flashcards", NB_A)).toBe(`/flashcards?cuaderno=${NB_A}`);
  });

  it("marks an item's link as opened from the hub, keeping the filter", () => {
    expect(hubItemHref("/exams/n/p", null)).toBe("/exams/n/p?desde=hub");
    expect(hubItemHref("/flashcards/n/p?repasar=1", NB_A)).toBe(
      `/flashcards/n/p?repasar=1&desde=hub&cuaderno=${NB_A}`,
    );
  });

  it("returns to the hub, keeping a valid filter; otherwise to the notebook's filter", () => {
    expect(hubReturnHref("/active-recall", { desde: "hub" }, NB_B)).toBe(
      "/active-recall",
    );
    expect(
      hubReturnHref("/active-recall", { desde: "hub", cuaderno: NB_A }, NB_B),
    ).toBe(`/active-recall?cuaderno=${NB_A}`);
    expect(
      hubReturnHref(
        "/active-recall",
        { desde: "hub", cuaderno: "https://example.com" },
        NB_B,
      ),
    ).toBe("/active-recall");
    expect(hubReturnHref("/active-recall", {}, NB_B)).toBe(
      `/active-recall?cuaderno=${NB_B}`,
    );
  });
});
