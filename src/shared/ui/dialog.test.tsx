import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

describe("DialogContent", () => {
  // globals.css defines no --popover token, so bg-popover rendered a
  // transparent dialog and whatever sat behind it showed through (same
  // root cause as the highlight picker's R3 follow-up).
  it("paints an opaque card surface with the modal shadow (lg)", () => {
    render(
      <Dialog open>
        <DialogContent data-testid="content">
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const className = screen.getByTestId("content").className;

    expect(className).toContain("bg-card");
    expect(className).toContain("text-fg");
    expect(className).toContain("border-border-default");
    expect(className).toContain("shadow-lg");
    expect(className).not.toContain("popover");
  });
});
