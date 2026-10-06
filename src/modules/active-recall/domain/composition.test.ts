import { describe, expect, it } from "vitest";
import { composeRecallSession, RECALL_SESSION_SIZE } from "./composition";

const base = new Date("2026-10-01T00:00:00.000Z");

function question(
  id: string,
  options: { createdDay?: number; archived?: boolean } = {},
) {
  return {
    id,
    createdAt: new Date(
      base.getTime() + (options.createdDay ?? 0) * 86_400_000,
    ),
    archivedAt: options.archived ? base : null,
  };
}

function many(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) =>
    question(`${prefix}-${String(i).padStart(2, "0")}`, { createdDay: i }),
  );
}

describe("composeRecallSession", () => {
  it("defaults to ten questions", () => {
    const questions = many("q", 15);

    expect(RECALL_SESSION_SIZE).toBe(10);
    expect(
      composeRecallSession({
        questions,
        dueIds: [],
        newIds: questions.map((q) => q.id),
      }),
    ).toHaveLength(10);
  });

  it("puts due questions first in the given due order, then new ones", () => {
    const questions = [
      question("new-late", { createdDay: 5 }),
      question("due-b"),
      question("new-early", { createdDay: 1 }),
      question("due-a"),
    ];

    expect(
      composeRecallSession({
        questions,
        dueIds: ["due-b", "due-a"],
        newIds: ["new-late", "new-early"],
      }),
    ).toEqual(["due-b", "due-a", "new-early", "new-late"]);
  });

  it("orders new questions by creation date, then by id", () => {
    const questions = [
      question("n-b", { createdDay: 2 }),
      question("n-c", { createdDay: 1 }),
      question("n-a", { createdDay: 2 }),
    ];

    expect(
      composeRecallSession({
        questions,
        dueIds: [],
        newIds: ["n-a", "n-b", "n-c"],
      }),
    ).toEqual(["n-c", "n-a", "n-b"]);
    expect(
      composeRecallSession({
        questions,
        dueIds: [],
        newIds: ["n-b", "n-a", "n-c"],
      }),
    ).toEqual(["n-c", "n-a", "n-b"]);
  });

  it("leaves out reviewed questions that are not due yet", () => {
    const questions = [question("due"), question("new"), question("later")];

    expect(
      composeRecallSession({ questions, dueIds: ["due"], newIds: ["new"] }),
    ).toEqual(["due", "new"]);
  });

  it("excludes archived questions even when due or new", () => {
    const questions = [
      question("due-archived", { archived: true }),
      question("new-archived", { archived: true }),
      question("due"),
    ];

    expect(
      composeRecallSession({
        questions,
        dueIds: ["due-archived", "due"],
        newIds: ["new-archived"],
      }),
    ).toEqual(["due"]);
  });

  it("ignores ids of unknown questions and repeated ids", () => {
    const questions = [question("a"), question("b")];

    expect(
      composeRecallSession({
        questions,
        dueIds: ["ghost", "a", "a"],
        newIds: ["a", "b", "b"],
      }),
    ).toEqual(["a", "b"]);
  });

  it("caps the session at the requested size, due first", () => {
    const due = many("d", 8);
    const fresh = many("n", 8);

    const result = composeRecallSession({
      questions: [...fresh, ...due],
      dueIds: due.map((q) => q.id),
      newIds: fresh.map((q) => q.id),
      size: 10,
    });

    expect(result).toEqual([...due.map((q) => q.id), "n-00", "n-01"]);
  });

  it("returns only due questions when they fill the session", () => {
    const due = many("d", 12);

    expect(
      composeRecallSession({
        questions: due,
        dueIds: due.map((q) => q.id),
        newIds: [],
        size: 3,
      }),
    ).toEqual(["d-00", "d-01", "d-02"]);
  });

  it("is empty when nothing is due or new, or the size is not positive", () => {
    const questions = many("q", 3);

    expect(composeRecallSession({ questions, dueIds: [], newIds: [] })).toEqual(
      [],
    );
    expect(
      composeRecallSession({
        questions,
        dueIds: ["q-00"],
        newIds: [],
        size: 0,
      }),
    ).toEqual([]);
  });

  it("is stable regardless of the question order", () => {
    const questions = many("q", 12);
    const input = {
      dueIds: ["q-05", "q-02"],
      newIds: questions.map((q) => q.id),
    };

    expect(
      composeRecallSession({ ...input, questions: [...questions].reverse() }),
    ).toEqual(composeRecallSession({ ...input, questions }));
  });
});
