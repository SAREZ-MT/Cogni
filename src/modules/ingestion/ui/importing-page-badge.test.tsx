import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportingPageBadge } from "./importing-page-badge";

const { useIsImporting } = vi.hoisted(() => ({ useIsImporting: vi.fn() }));
vi.mock("./active-imports-provider", () => ({ useIsImporting }));

// design.md, "Decision: Vista de página ...": LoaderCircle icon in muted
// text color next to a page with a non-terminal import, disappearing
// without a reload once the job is no longer active.
describe("ImportingPageBadge", () => {
  it("renders nothing when the page is not importing", () => {
    useIsImporting.mockReturnValue(false);

    const { container } = render(<ImportingPageBadge pageId="page-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a spinning icon with the accessible name when the page is importing", () => {
    useIsImporting.mockReturnValue(true);

    render(<ImportingPageBadge pageId="page-1" />);

    const icon = screen.getByRole("img", { name: "Importando documento" });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("animate-spin");
    expect(icon).toHaveClass("motion-reduce:animate-none");
    expect(icon).toHaveClass("text-muted-foreground");
  });

  it("asks useIsImporting for exactly this page's id", () => {
    useIsImporting.mockReturnValue(false);

    render(<ImportingPageBadge pageId="page-42" />);

    expect(useIsImporting).toHaveBeenCalledWith("page-42");
  });
});
