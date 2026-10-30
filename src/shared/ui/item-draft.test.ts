import { describe, expect, it } from "vitest";
import {
  addDraftEntry,
  draftChangeCount,
  draftFrom,
  draftOperations,
  removeDraftEntry,
  restoreDraftEntry,
  updateDraftEntry,
} from "./item-draft";

interface Side {
  front: string;
  back: string;
}

const items = [
  { id: "a", value: { front: "A", back: "a" } },
  { id: "b", value: { front: "B", back: "b" } },
  { id: "c", value: { front: "C", back: "c" } },
];

describe("item draft (Phase 8 H18 edit pages)", () => {
  it("starts clean, with one entry per stored item", () => {
    const draft = draftFrom<Side>(items);

    expect(draft.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(draftChangeCount(draft)).toBe(0);
    expect(draftOperations(draft)).toEqual({
      updates: [],
      creates: [],
      deletes: [],
    });
  });

  it("reduces edits, additions and deletions to the operations a save sends", () => {
    let draft = draftFrom<Side>(items);
    const [a, b] = draft;
    draft = updateDraftEntry(draft, a?.key ?? "", { front: "A2", back: "a" });
    draft = removeDraftEntry(draft, b?.key ?? "");
    draft = addDraftEntry(draft, { front: "Nueva", back: "n" });

    expect(draftOperations(draft)).toEqual({
      updates: [{ id: "a", front: "A2", back: "a" }],
      creates: [{ front: "Nueva", back: "n" }],
      deletes: ["b"],
    });
    expect(draftChangeCount(draft)).toBe(3);
  });

  it("sends the stored version of each edited item, so the server can refuse a stale save", () => {
    let draft = draftFrom<Side>([
      { id: "a", value: { front: "A", back: "a" }, version: "v-a" },
      { id: "b", value: { front: "B", back: "b" } },
    ]);
    const [a, b] = draft;
    draft = updateDraftEntry(draft, a?.key ?? "", { front: "A2", back: "a" });
    draft = updateDraftEntry(draft, b?.key ?? "", { front: "B2", back: "b" });

    expect(draftOperations(draft).updates).toEqual([
      { id: "a", version: "v-a", front: "A2", back: "a" },
      { id: "b", front: "B2", back: "b" },
    ]);
    expect(draftOperations(draft).updates[1]).not.toHaveProperty("version");
  });

  it("forgets an edit put back to the stored value and a restored deletion", () => {
    let draft = draftFrom<Side>(items);
    const [a, b] = draft;
    draft = updateDraftEntry(draft, a?.key ?? "", { front: "A2", back: "a" });
    draft = updateDraftEntry(draft, a?.key ?? "", { front: "A", back: "a" });
    draft = removeDraftEntry(draft, b?.key ?? "");
    draft = restoreDraftEntry(draft, b?.key ?? "");

    expect(draftChangeCount(draft)).toBe(0);
  });

  it("drops a new entry removed before saving, and never sends an edit of a deleted item", () => {
    let draft = addDraftEntry(draftFrom<Side>(items), {
      front: "N",
      back: "n",
    });
    const added = draft.at(-1);
    draft = removeDraftEntry(draft, added?.key ?? "");
    const [a] = draft;
    draft = updateDraftEntry(draft, a?.key ?? "", { front: "X", back: "x" });
    draft = removeDraftEntry(draft, a?.key ?? "");

    expect(draft).toHaveLength(3);
    expect(draftOperations(draft)).toEqual({
      updates: [],
      creates: [],
      deletes: ["a"],
    });
  });
});
