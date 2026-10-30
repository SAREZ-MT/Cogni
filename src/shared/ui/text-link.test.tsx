import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextLink } from "./text-link";

describe("TextLink", () => {
  it("renders an anchor that reads as a link", () => {
    render(<TextLink href="/register">Crea una</TextLink>);

    const link = screen.getByRole("link", { name: "Crea una" });
    expect(link).toHaveAttribute("href", "/register");
    expect(link).toHaveAttribute("data-slot", "text-link");
    expect(link).toHaveClass(
      "font-medium",
      "text-fg-active",
      "hover:underline",
    );
  });

  it("forwards className", () => {
    render(
      <TextLink href="/x" className="extra">
        x
      </TextLink>,
    );

    expect(screen.getByRole("link", { name: "x" })).toHaveClass("extra");
  });
});
