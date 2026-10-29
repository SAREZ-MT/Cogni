import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

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

// Phase 8 H12 (user 2026-10-29): one polished form-dialog shell for every
// modal: an optional header icon, a separated footer and a Spanish close.
describe("Dialog shell", () => {
  it("renders an optional header icon beside the title and description", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader icon={<span data-testid="icon" />}>
            <DialogTitle>Crear flashcards</DialogTitle>
            <DialogDescription>Elige la página.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const icon = screen.getByTestId("icon");
    expect(icon.closest('[data-slot="dialog-header-icon"]')).not.toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Crear flashcards" }),
    ).toHaveAccessibleDescription("Elige la página.");
  });

  it("separates the footer from the body", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogFooter data-testid="footer">acciones</DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByTestId("footer").className).toContain("border-t");
  });

  it("labels the close button in Spanish", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
