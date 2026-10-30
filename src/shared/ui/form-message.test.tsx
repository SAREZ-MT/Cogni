import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormMessage } from "./form-message";

// Phase 8 H12: the dialogs' feedback box.
describe("FormMessage", () => {
  it("is an alert by default", () => {
    render(<FormMessage>No pudimos guardar.</FormMessage>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No pudimos guardar.");
    expect(alert).toHaveAttribute("data-tone", "error");
  });

  it("is a calm note with the info tone", () => {
    render(<FormMessage tone="info">Nada nuevo.</FormMessage>);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Nada nuevo.")).toHaveAttribute(
      "data-tone",
      "info",
    );
  });
});
