import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackLink } from "./back-link";

describe("BackLink", () => {
  it("renders a link to the given href named by its label", () => {
    render(<BackLink href="/notebooks">Cuadernos</BackLink>);

    expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
      "href",
      "/notebooks",
    );
  });

  it("merges a custom className", () => {
    render(
      <BackLink href="/x" className="extra">
        Atrás
      </BackLink>,
    );

    expect(screen.getByRole("link")).toHaveClass("extra");
  });
});
