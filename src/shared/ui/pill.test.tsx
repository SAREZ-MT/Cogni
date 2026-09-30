import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "./pill";

describe("Pill", () => {
  it("renders its label in a span with forwarded props", () => {
    render(
      <Pill data-testid="pill" className="extra">
        pronto
      </Pill>,
    );

    const pill = screen.getByTestId("pill");
    expect(pill.tagName).toBe("SPAN");
    expect(pill).toHaveAttribute("data-slot", "pill");
    expect(pill).toHaveTextContent("pronto");
    expect(pill).toHaveClass("extra");
  });

  it("defaults to the small neutral pill", () => {
    render(<Pill data-testid="pill">x</Pill>);

    const pill = screen.getByTestId("pill");
    expect(pill).toHaveClass("text-[10.5px]", "bg-neutral-150");
  });

  it("maps the md size", () => {
    render(
      <Pill data-testid="pill" size="md">
        x
      </Pill>,
    );

    const pill = screen.getByTestId("pill");
    expect(pill).toHaveClass("text-[11.5px]");
    expect(pill).not.toHaveClass("text-[10.5px]");
  });

  it.each([
    ["purple", "bg-pastel-purple"],
    ["mint", "bg-pastel-mint"],
    ["primary", "bg-primary-100"],
    ["success", "bg-success-100"],
    ["warning", "bg-warning-100"],
    ["error", "bg-error-100"],
    ["info", "bg-info-100"],
    ["muted", "bg-transparent"],
  ] as const)("maps tone %s to %s", (tone, expected) => {
    render(
      <Pill data-testid="pill" tone={tone}>
        x
      </Pill>,
    );

    expect(screen.getByTestId("pill")).toHaveClass(expected);
  });

  it("renders no dot or icon by default", () => {
    render(<Pill data-testid="pill">x</Pill>);

    expect(screen.getByTestId("pill").children).toHaveLength(0);
  });

  it("renders a decorative leading dot that is hidden from assistive tech", () => {
    render(
      <Pill data-testid="pill" dot>
        Activo
      </Pill>,
    );

    const pill = screen.getByTestId("pill");
    const dot = pill.querySelector("span");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("bg-current");
    expect(pill).toHaveTextContent("Activo");
  });

  it("renders the icon before the label", () => {
    render(
      <Pill data-testid="pill" icon={<svg data-testid="icon" />}>
        Racha
      </Pill>,
    );

    const pill = screen.getByTestId("pill");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(pill.firstChild).toBe(screen.getByTestId("icon"));
    expect(pill.lastChild?.textContent).toBe("Racha");
  });

  it("puts the dot before the icon when both are given", () => {
    render(
      <Pill data-testid="pill" dot icon={<svg data-testid="icon" />}>
        x
      </Pill>,
    );

    const [first, second] = Array.from(screen.getByTestId("pill").children);
    expect(first).toHaveAttribute("aria-hidden", "true");
    expect(second).toBe(screen.getByTestId("icon"));
  });

  it("lets className override the text size", () => {
    render(
      <Pill data-testid="pill" className="text-[10px]">
        x
      </Pill>,
    );

    const pill = screen.getByTestId("pill");
    expect(pill).toHaveClass("text-[10px]");
    expect(pill).not.toHaveClass("text-[10.5px]");
  });
});
