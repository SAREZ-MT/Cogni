import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidePanel } from "./side-panel";

function renderPanel(collapsed: boolean, extra = {}) {
  return render(
    <SidePanel
      collapsed={collapsed}
      aria-label="Técnicas de estudio"
      data-testid="panel"
      header={<span>header</span>}
      collapsedContent={<span>rail</span>}
      {...extra}
    >
      <span>full</span>
    </SidePanel>,
  );
}

describe("SidePanel", () => {
  it("is a named complementary landmark", () => {
    renderPanel(false);

    expect(
      screen.getByRole("complementary", { name: "Técnicas de estudio" }),
    ).toBeInTheDocument();
  });

  it("shows the full content and the expanded width when expanded", () => {
    renderPanel(false);

    const panel = screen.getByTestId("panel");
    expect(panel).toHaveAttribute("data-collapsed", "false");
    expect(panel).toHaveStyle({ width: "264px", minWidth: "264px" });
    expect(screen.getByText("full")).toBeInTheDocument();
    expect(screen.queryByText("rail")).not.toBeInTheDocument();
  });

  it("swaps to the icon rail and the collapsed width when collapsed", () => {
    renderPanel(true);

    const panel = screen.getByTestId("panel");
    expect(panel).toHaveAttribute("data-collapsed", "true");
    expect(panel).toHaveStyle({ width: "52px", minWidth: "52px" });
    expect(screen.getByText("rail")).toBeInTheDocument();
    expect(screen.queryByText("full")).not.toBeInTheDocument();
  });

  it("always renders the header, in both states", () => {
    const { unmount } = renderPanel(false);
    expect(screen.getByText("header")).toBeInTheDocument();
    unmount();
    renderPanel(true);
    expect(screen.getByText("header")).toBeInTheDocument();
  });

  it("honours custom widths and side", () => {
    renderPanel(false, { width: 300, collapsedWidth: 40, side: "left" });

    const panel = screen.getByTestId("panel");
    expect(panel).toHaveStyle({ width: "300px" });
    expect(panel).toHaveAttribute("data-side", "left");
  });
});
