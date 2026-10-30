import { describe, expect, it } from "vitest";
import type {
  RecallHubPage,
  RecallHubReader,
  RecallHubSession,
} from "../domain/recall-hub-reader";
import {
  listRecallHub,
  type RecallDueCounts,
  type RecallPageMasterySource,
} from "./list-recall-hub";

const OWNER = "owner-1";

function session(
  id: string,
  finishedAt: string,
  scores: [ai: number | null, combined: number | null][],
): RecallHubSession {
  return {
    id,
    finishedAt: new Date(finishedAt),
    answers: scores.map(([aiScore, combinedQuality]) => ({
      aiScore,
      combinedQuality,
    })),
  };
}

function page(
  pageId: string,
  sessions: RecallHubSession[],
  overrides: Partial<RecallHubPage> = {},
): RecallHubPage {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: "nb-1",
    notebookTitle: "Biología celular",
    notebookColor: "green",
    sessions,
    questionCount: 6,
    latestQuestionAt: new Date("2026-10-05T10:00:00.000Z"),
    ...overrides,
  };
}

function reader(
  pages: RecallHubPage[],
  owners: string[] = [],
): RecallHubReader {
  return {
    async listRecallPages(ownerId) {
      owners.push(ownerId);
      return pages;
    },
  };
}

function mastery(
  scores: Record<string, number> | null,
  owners: string[] = [],
): RecallPageMasterySource {
  return {
    async masteryByPage(ownerId) {
      owners.push(ownerId);
      return scores === null ? null : new Map(Object.entries(scores));
    },
  };
}

function due(
  counts: Record<string, number> | null,
  owners: string[] = [],
): RecallDueCounts {
  return {
    async recallQuestionsDueByPage(ownerId) {
      owners.push(ownerId);
      return counts === null ? null : new Map(Object.entries(counts));
    },
  };
}

describe("listRecallHub", () => {
  it("maps every session to its date, question count, AI buckets and percentage", async () => {
    const result = await listRecallHub(
      {
        reader: reader([
          page("p-1", [
            // AI 5, 3, 1, 0 → 1 correct, 1 partial, 2 incorrect; combined
            // (4 + 3 + 2 + 0) / 4 = 2.25 → round(45) = 45 %.
            session("s-2", "2026-10-07T10:00:00.000Z", [
              [5, 4],
              [3, 3],
              [1, 2],
              [0, 0],
            ]),
            // Still evaluating: no bucket, no percentage.
            session("s-1", "2026-10-06T10:00:00.000Z", [
              [null, null],
              [null, null],
            ]),
          ]),
        ]),
        mastery: mastery({ "p-1": 0.5 }),
        due: due({}),
      },
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pages).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Página p-1",
        notebookId: "nb-1",
        notebookTitle: "Biología celular",
        notebookColor: "green",
        mastery: 50,
        dueToday: 0,
        // Phase 8 H17: the page's active questions and newest one.
        questionCount: 6,
        latestQuestionAt: new Date("2026-10-05T10:00:00.000Z"),
        sessions: [
          {
            id: "s-2",
            finishedAt: new Date("2026-10-07T10:00:00.000Z"),
            questionCount: 4,
            correct: 1,
            partial: 1,
            incorrect: 2,
            percentage: 45,
          },
          {
            id: "s-1",
            finishedAt: new Date("2026-10-06T10:00:00.000Z"),
            questionCount: 2,
            correct: 0,
            partial: 0,
            incorrect: 0,
            percentage: null,
          },
        ],
      },
    ]);
  });

  it("reads everything for the requested owner only", async () => {
    const readerOwners: string[] = [];
    const masteryOwners: string[] = [];
    const dueOwners: string[] = [];

    await listRecallHub(
      {
        reader: reader([], readerOwners),
        mastery: mastery({}, masteryOwners),
        due: due({}, dueOwners),
      },
      OWNER,
    );

    expect(readerOwners).toEqual([OWNER]);
    expect(masteryOwners).toEqual([OWNER]);
    expect(dueOwners).toEqual([OWNER]);
  });

  it("averages the study-engine page mastery of the listed pages as a whole percent", async () => {
    const result = await listRecallHub(
      {
        reader: reader([
          page("p-1", [session("s-1", "2026-10-07T10:00:00.000Z", [[5, 5]])]),
          page("p-2", [session("s-2", "2026-10-06T10:00:00.000Z", [[0, 0]])]),
          page("p-3", [session("s-3", "2026-10-05T10:00:00.000Z", [[3, 3]])]),
        ]),
        // p-3 has no mastery row yet (never reviewed): it counts as 0. A
        // page without recall sessions (p-9) is not part of the average.
        mastery: mastery({ "p-1": 0.8, "p-2": 0.35, "p-9": 1 }),
        due: due({}),
      },
      OWNER,
    );

    expect(result.ok && result.value.pages.map((p) => p.mastery)).toEqual([
      80, 35, 0,
    ]);
    // (80 + 35 + 0) / 3 = 38.33 → 38
    expect(result.ok && result.value.averageMastery).toBe(38);
  });

  it("rounds the page mastery score to a whole percent", async () => {
    const result = await listRecallHub(
      {
        reader: reader([
          page("p-1", [session("s-1", "2026-10-07T10:00:00.000Z", [[5, 5]])]),
        ]),
        mastery: mastery({ "p-1": 0.6666 }),
        due: due({}),
      },
      OWNER,
    );

    expect(result.ok && result.value.pages[0]?.mastery).toBe(67);
    expect(result.ok && result.value.averageMastery).toBe(67);
  });

  it("degrades an unreadable mastery to unknown, never to zero", async () => {
    const result = await listRecallHub(
      {
        reader: reader([
          page("p-1", [session("s-1", "2026-10-07T10:00:00.000Z", [[5, 5]])]),
        ]),
        mastery: mastery(null),
        due: due({}),
      },
      OWNER,
    );

    expect(result.ok && result.value.pages[0]?.mastery).toBeNull();
    expect(result.ok && result.value.averageMastery).toBeNull();
  });

  it("has no average mastery when no page has a session", async () => {
    const result = await listRecallHub(
      { reader: reader([]), mastery: mastery({ "p-1": 1 }), due: due({}) },
      OWNER,
    );

    expect(result.ok && result.value).toEqual({
      pages: [],
      averageMastery: null,
    });
  });

  it("carries the recall questions due today per page, unknown when the list cannot be read", async () => {
    const pages = [
      page("p-1", [session("s-1", "2026-10-07T10:00:00.000Z", [[5, 5]])]),
      page("p-2", [session("s-2", "2026-10-06T10:00:00.000Z", [[5, 5]])]),
    ];

    const known = await listRecallHub(
      { reader: reader(pages), mastery: mastery({}), due: due({ "p-2": 3 }) },
      OWNER,
    );
    const unknown = await listRecallHub(
      { reader: reader(pages), mastery: mastery({}), due: due(null) },
      OWNER,
    );

    expect(known.ok && known.value.pages.map((p) => p.dueToday)).toEqual([
      0, 3,
    ]);
    expect(unknown.ok && unknown.value.pages.map((p) => p.dueToday)).toEqual([
      null,
      null,
    ]);
  });

  it("lists a page with questions and no finished session, with no sessions and its question count", async () => {
    const result = await listRecallHub(
      {
        reader: reader([page("p-1", [], { questionCount: 3 })]),
        mastery: mastery({}),
        due: due({ "p-1": 3 }),
      },
      OWNER,
    );

    expect(result.ok && result.value.pages).toEqual([
      expect.objectContaining({
        pageId: "p-1",
        sessions: [],
        questionCount: 3,
        dueToday: 3,
        mastery: 0,
      }),
    ]);
  });

  it("keeps the reader's page order", async () => {
    const result = await listRecallHub(
      {
        reader: reader([
          page("b", [session("s-1", "2026-10-07T10:00:00.000Z", [[5, 5]])]),
          page("a", [session("s-2", "2026-10-08T10:00:00.000Z", [[5, 5]])]),
        ]),
        mastery: mastery({}),
        due: due({}),
      },
      OWNER,
    );

    expect(result.ok && result.value.pages.map((p) => p.pageId)).toEqual([
      "b",
      "a",
    ]);
  });
});
