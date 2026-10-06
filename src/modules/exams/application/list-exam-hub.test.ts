import { describe, expect, it } from "vitest";
import type { ExamHubPage } from "../domain/exam-hub-reader";
import { listExamHub } from "./list-exam-hub";

const OWNER = "owner-1";

function hubPage(overrides: Partial<ExamHubPage> = {}): ExamHubPage {
  return {
    pageId: "page-1",
    pageTitle: "Mitocondria",
    notebookId: "nb-1",
    notebookTitle: "Biología",
    notebookColor: "green",
    activeQuestionCount: 10,
    attempts: 0,
    lastSession: null,
    retakePending: false,
    ...overrides,
  };
}

function deps(
  pages: ExamHubPage[],
  due: ReadonlyMap<string, number> | null = new Map(),
) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      reader: {
        async listExamPages(ownerId: string) {
          calls.push(`reader:${ownerId}`);
          return pages;
        },
      },
      due: {
        async examQuestionsDueByPage(ownerId: string) {
          calls.push(`due:${ownerId}`);
          return due;
        },
      },
    },
  };
}

describe("listExamHub", () => {
  it("reads the owner's exam pages and due counts", async () => {
    const { calls, deps: d } = deps([hubPage()]);

    const result = await listExamHub(d, OWNER);

    expect(result.ok).toBe(true);
    expect(calls.sort()).toEqual([`due:${OWNER}`, `reader:${OWNER}`]);
  });

  it("maps a never-examined page: no score, not passed, ready with 10 questions", async () => {
    const { deps: d } = deps([hubPage()]);

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value).toEqual([
      {
        pageId: "page-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        notebookTitle: "Biología",
        notebookColor: "green",
        questionCount: 10,
        attempts: 0,
        lastScore: null,
        passed: false,
        lastFinishedAt: null,
        retakePending: false,
        ready: true,
        dueToday: 0,
      },
    ]);
  });

  it("is not ready below 10 active questions", async () => {
    const { deps: d } = deps([hubPage({ activeQuestionCount: 9 })]);

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]?.ready).toBe(false);
  });

  it("reports the last exam's whole percent rounded down and its outcome", async () => {
    const finishedAt = new Date("2026-10-05T10:00:00.000Z");
    const { deps: d } = deps([
      hubPage({
        attempts: 3,
        lastSession: { finishedAt, total: 30, correct: 20, passed: false },
        retakePending: true,
      }),
    ]);

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]).toMatchObject({
      attempts: 3,
      lastScore: 66,
      passed: false,
      lastFinishedAt: finishedAt,
      retakePending: true,
    });
  });

  it("counts the page's exam questions due today from the due list", async () => {
    const { deps: d } = deps(
      [hubPage(), hubPage({ pageId: "page-2" })],
      new Map([["page-2", 4]]),
    );

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value.map((page) => page.dueToday)).toEqual([
      0, 4,
    ]);
  });

  it("leaves the due count unknown when the due list cannot load", async () => {
    const { deps: d } = deps([hubPage()], null);

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]?.dueToday).toBeNull();
  });

  it("keeps the reader's order", async () => {
    const { deps: d } = deps([
      hubPage({ pageId: "b" }),
      hubPage({ pageId: "a" }),
    ]);

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value.map((page) => page.pageId)).toEqual([
      "b",
      "a",
    ]);
  });
});
