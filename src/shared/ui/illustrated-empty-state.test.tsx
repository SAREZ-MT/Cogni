import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reduced.value,
}));

import { IllustratedEmptyState } from "./illustrated-empty-state";

const IMAGE = {
  src: "/illustrations/calendar-empty.webp",
  width: 1600,
  height: 1102,
};

describe("IllustratedEmptyState", () => {
  it("shows a decorative illustration on a gradient backdrop over a big title and its message", () => {
    const { container } = render(
      <IllustratedEmptyState
        image={IMAGE}
        title="Hoy estás al día"
        description="No tienes repasos pendientes."
        action={<a href="/x">Ver la semana</a>}
      />,
    );

    const root = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    );
    expect(root).toHaveClass("empty-state-glow");
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image?.getAttribute("src")).toContain("calendar-empty.webp");
    expect(image).not.toHaveClass("mask-fade-edges");
    const art = container.querySelector('[data-part="art"]');
    expect(art).toHaveClass("illustration-backdrop");
    expect(art).toContainElement(image as HTMLElement);
    const title = screen.getByRole("heading", { name: "Hoy estás al día" });
    expect(title).toHaveClass("text-gradient-brand");
    expect(
      screen.getByText("No tienes repasos pendientes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la semana" })).toHaveAttribute(
      "href",
      "/x",
    );
  });

  it("omits the action slot when none is given", () => {
    const { container } = render(
      <IllustratedEmptyState image={IMAGE} title="t" description="d" />,
    );
    expect(container.querySelector('[data-part="action"]')).toBeNull();
  });
});
