import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SaveStatus } from "./save-status";

// specs/editor/spec.md, "Autosave con debounce y actualización optimista":
// visible status copy, Spanish "tú", sentence case, no emoji
// (.agents/skills/cogni-design/SKILL.md); role="status" + aria-live
// "polite" so screen readers announce a save without stealing focus.
describe("SaveStatus", () => {
  it("shows nothing for idle", () => {
    render(<SaveStatus status="idle" />);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it.each([
    ["pending", "guardando…"],
    ["saving", "guardando…"],
    ["saved", "guardado"],
    ["error", "no se pudo guardar, reintentando…"],
    ["conflict", "la página cambió en otra pestaña"],
  ] as const)("shows the Spanish copy for %s", (status, copy) => {
    render(<SaveStatus status={status} />);
    expect(screen.getByRole("status")).toHaveTextContent(copy);
  });

  it("is announced politely without stealing focus", () => {
    render(<SaveStatus status="saved" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
