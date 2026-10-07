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
    failedRootIds: [],
    ...overrides,
  };
}

function deps(
  pages: ExamHubPage[],
  due: ReadonlyMap<string, number> | null = new Map(),
  rootsDue: ReadonlySet<string> | null = new Set(),
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
        async examRootsDueNow(ownerId: string) {
          calls.push(`roots:${ownerId}`);
          return rootsDue;
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

  it("maps a never-examined page: no score, not passed", async () => {
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
        dueToday: 0,
        failedDueNow: false,
      },
    ]);
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

  it("says the failed questions are not due when only other questions of the page are", async () => {
    const { calls, deps: d } = deps(
      [hubPage({ retakePending: true, failedRootIds: ["failed-1"] })],
      new Map([["page-1", 3]]),
      new Set(["passed-1", "passed-2", "passed-3"]),
    );

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]).toMatchObject({
      dueToday: 3,
      failedDueNow: false,
    });
    expect(calls).toContain(`roots:${OWNER}`);
  });

  it("says the failed questions are due once one of them is", async () => {
    const { deps: d } = deps(
      [
        hubPage({
          retakePending: true,
          failedRootIds: ["failed-1", "failed-2"],
        }),
      ],
      new Map([["page-1", 1]]),
      new Set(["failed-2"]),
    );

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]?.failedDueNow).toBe(true);
  });

  it("leaves the failed questions' due state unknown when their due items cannot load", async () => {
    const { deps: d } = deps(
      [hubPage({ retakePending: true, failedRootIds: ["failed-1"] })],
      new Map(),
      null,
    );

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]?.failedDueNow).toBeNull();
  });

  it("skips the due items read when no page waits for a retake", async () => {
    const { calls, deps: d } = deps([hubPage()], new Map(), null);

    const result = await listExamHub(d, OWNER);

    expect(result.ok && result.value[0]?.failedDueNow).toBe(false);
    expect(calls).not.toContain(`roots:${OWNER}`);
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
