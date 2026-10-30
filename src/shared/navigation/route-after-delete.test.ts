import { describe, expect, it } from "vitest";
import { routeAfterDelete } from "./route-after-delete";

const NB = "11111111-1111-4111-8111-111111111111";
const PG = "22222222-2222-4222-8222-222222222222";

describe("routeAfterDelete (Phase 8 H19)", () => {
  it("leaves a deleted notebook's routes for Cuadernos", () => {
    expect(routeAfterDelete(`/notebooks/${NB}`, { notebookId: NB })).toBe(
      "/notebooks",
    );
    expect(
      routeAfterDelete(`/notebooks/${NB}/pages/${PG}`, { notebookId: NB }),
    ).toBe("/notebooks");
    expect(
      routeAfterDelete(`/flashcards/${NB}/${PG}/editar`, { notebookId: NB }),
    ).toBe("/notebooks");
  });

  it("leaves a deleted page's routes for its notebook", () => {
    expect(
      routeAfterDelete(`/notebooks/${NB}/pages/${PG}`, {
        notebookId: NB,
        pageId: PG,
      }),
    ).toBe(`/notebooks/${NB}`);
    expect(
      routeAfterDelete(`/exams/${NB}/${PG}`, { notebookId: NB, pageId: PG }),
    ).toBe(`/notebooks/${NB}`);
  });

  it("stays put on any other route", () => {
    expect(routeAfterDelete("/notebooks", { notebookId: NB })).toBeNull();
    expect(routeAfterDelete("/flashcards", { notebookId: NB })).toBeNull();
    expect(
      routeAfterDelete(`/notebooks/${NB}`, { notebookId: NB, pageId: PG }),
    ).toBeNull();
  });
});
