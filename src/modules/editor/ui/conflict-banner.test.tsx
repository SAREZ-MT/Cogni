import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TiptapDoc } from "../domain/save-page-port";
import { ConflictBanner } from "./conflict-banner";

function doc(text: string): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

// specs/editor/spec.md, "Reconciliación del conflicto de versión": informs
// the user in Spanish that the page changed in another tab, and keeps the
// local draft accessible until they restore or discard it.
describe("ConflictBanner", () => {
  it("renders nothing when there is no draft to reconcile", () => {
    render(
      <ConflictBanner
        conflictDraft={null}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the Spanish notice and both actions when there is a draft", () => {
    render(
      <ConflictBanner
        conflictDraft={doc("mi borrador")}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(
      screen.getByText("esta página cambió en otra pestaña"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "recuperar mi borrador" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "descartar" }),
    ).toBeInTheDocument();
  });

  it("calls onRestore when the user chooses to recover the draft", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(
      <ConflictBanner
        conflictDraft={doc("mi borrador")}
        onRestore={onRestore}
        onDiscard={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "recuperar mi borrador" }),
    );

    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("calls onDiscard when the user chooses to discard the draft", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(
      <ConflictBanner
        conflictDraft={doc("mi borrador")}
        onRestore={vi.fn()}
        onDiscard={onDiscard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "descartar" }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
