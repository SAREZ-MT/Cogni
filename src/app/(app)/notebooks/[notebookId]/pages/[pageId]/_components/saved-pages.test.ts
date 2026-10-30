import { beforeEach, describe, expect, it } from "vitest";
import type { TiptapDoc } from "@/modules/editor";
import {
  forgetSavedPages,
  freshestPage,
  rememberSavedPage,
} from "./saved-pages";

function doc(text: string): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  } as TiptapDoc;
}

describe("saved pages", () => {
  beforeEach(() => forgetSavedPages());

  it("keeps the payload when the page saved nothing in this session", () => {
    expect(freshestPage("p1", doc("payload"), 3)).toEqual({
      content: doc("payload"),
      version: 3,
      stale: false,
    });
  });

  it("opens the last saved document over an older payload", () => {
    rememberSavedPage("p1", doc("saved"), 5);

    expect(freshestPage("p1", doc("payload"), 1)).toEqual({
      content: doc("saved"),
      version: 5,
      stale: true,
    });
  });

  it("keeps a payload as new as or newer than the last save", () => {
    rememberSavedPage("p1", doc("saved"), 5);

    expect(freshestPage("p1", doc("same"), 5).stale).toBe(false);
    expect(freshestPage("p1", doc("newer"), 7)).toEqual({
      content: doc("newer"),
      version: 7,
      stale: false,
    });
  });

  it("never lets a late, older save replace a newer one", () => {
    rememberSavedPage("p1", doc("v6"), 6);
    rememberSavedPage("p1", doc("v4"), 4);

    expect(freshestPage("p1", doc("payload"), 1).content).toEqual(doc("v6"));
  });

  it("keeps each page's record apart", () => {
    rememberSavedPage("p1", doc("one"), 2);

    expect(freshestPage("p2", doc("two"), 1).stale).toBe(false);
  });
});
