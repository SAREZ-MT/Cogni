import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { start } = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../product-tour/product-tour", () => ({
  useProductTour: () => ({ start }),
  TourAutoStart: () => null,
}));

vi.mock("@/modules/notebooks", () => ({
  CreateNotebookTrigger: ({
    label,
    tourId,
    openAfterCreate,
  }: {
    label?: string;
    tourId?: string;
    openAfterCreate?: boolean;
  }) => (
    <button
      type="button"
      data-tour={tourId}
      data-open-after-create={openAfterCreate ? "true" : undefined}
    >
      {label}
    </button>
  ),
}));

import { HomeEmptyState } from "./home-empty-state";

describe("HomeEmptyState", () => {
  beforeEach(() => {
    start.mockReset();
  });

  // User decision 2026-10-17: the empty state drops the corner greeting.
  it("shows no greeting", () => {
    render(<HomeEmptyState />);

    expect(screen.queryByText(/^Buen(os días|as tardes|as noches)/)).toBeNull();
  });

  it("titles the page with an h1 and explains what Home will hold", () => {
    render(<HomeEmptyState />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Tu inicio está vacío por ahora",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cuando crees tu primer cuaderno, aquí verás los repasos de hoy, tus páginas recientes y los temas que más te cuestan.",
      ),
    ).toBeInTheDocument();
  });

  it("offers one primary create button anchored for the tour", () => {
    render(<HomeEmptyState />);

    const create = screen.getByRole("button", {
      name: "Crea tu primer cuaderno",
    });
    expect(create).toHaveAttribute("data-tour", "crear-cuaderno");
  });

  it("opens the new notebook after creating the first one", () => {
    render(<HomeEmptyState />);

    expect(
      screen.getByRole("button", { name: "Crea tu primer cuaderno" }),
    ).toHaveAttribute("data-open-after-create", "true");
  });

  it("relaunches the product tour from Ver tutorial", async () => {
    const user = userEvent.setup();
    render(<HomeEmptyState />);

    await user.click(screen.getByRole("button", { name: "Ver tutorial" }));

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("previews the three Home sections as static boxes", () => {
    render(<HomeEmptyState />);

    const preview = screen.getByRole("region", { name: "Lo que verás aquí" });
    expect(
      within(preview)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Para hoy", "Continúa donde lo dejaste", "Temas débiles"]);
    expect(
      within(preview).getByText(
        "Los repasos que te tocan hoy, según la repetición espaciada.",
      ),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText("Las últimas páginas que abriste, a un clic."),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Lo que más te cuesta en recordación activa y exámenes.",
      ),
    ).toBeInTheDocument();
    expect(within(preview).queryByRole("button")).toBeNull();
    expect(within(preview).queryByRole("link")).toBeNull();
  });

  it("illustrates the notebook with the three technique colours, decoratively", () => {
    const { container } = render(<HomeEmptyState />);

    const fan = container.querySelector('[data-slot="technique-fan"]');
    expect(fan).toHaveAttribute("aria-hidden", "true");
    expect(fan?.querySelectorAll('[data-part="fan-card"]')).toHaveLength(3);
    expect(fan?.querySelector('[data-part="notebook"]')).not.toBeNull();
  });

  it("fills the whole content area with a static decorative backdrop", () => {
    const { container } = render(<HomeEmptyState />);

    const backdrop = container.querySelector('[data-slot="study-backdrop"]');
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    // Spans the padding of <main> too, not just the centred column.
    expect(backdrop?.parentElement).toBe(container.querySelector("section"));
  });

  it("marks which techniques feed each preview box", () => {
    render(<HomeEmptyState />);

    const preview = screen.getByRole("region", { name: "Lo que verás aquí" });
    const dotsIn = (title: string) =>
      within(preview)
        .getByRole("heading", { level: 3, name: title })
        .closest('[data-slot="feature-preview-card"]')
        ?.querySelectorAll('[data-part="technique-dot"]').length ?? 0;
    expect(dotsIn("Para hoy")).toBe(3);
    expect(dotsIn("Continúa donde lo dejaste")).toBe(0);
    expect(dotsIn("Temas débiles")).toBe(2);
  });

  it("shows no metrics, streaks or zero counters", () => {
    render(<HomeEmptyState />);

    expect(screen.queryByText(/\b0\b/)).toBeNull();
    expect(screen.queryByText(/racha/i)).toBeNull();
  });
});
