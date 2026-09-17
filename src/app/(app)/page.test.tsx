import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage (app shell empty state)", () => {
  it("shows the encouraging empty-state copy in Spanish", () => {
    render(<HomePage />);

    expect(
      screen.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toBeInTheDocument();
  });

  it("does not expose any product feature link", () => {
    render(<HomePage />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
