import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSheetFan } from "./page-sheet-fan";

// Phase 8 H5-T4 (user request 2026-10-29): an empty notebook's hero, three
// paper sheets in the notebook's colour fanned out.
describe("PageSheetFan", () => {
  it("is decorative and fans three sheets, the front one last", () => {
    const { container } = render(<PageSheetFan />);

    const fan = container.querySelector('[data-slot="page-sheet-fan"]');
    expect(fan).toHaveAttribute("aria-hidden", "true");
    const sheets = [...container.querySelectorAll('[data-part="fan-sheet"]')];
    expect(sheets.map((sheet) => sheet.getAttribute("data-sheet"))).toEqual([
      "left",
      "right",
      "front",
    ]);
  });

  it("tints every sheet with the notebook's colour, violet without one", () => {
    const { container, rerender } = render(<PageSheetFan tone="orange" />);
    const tones = () =>
      [...container.querySelectorAll('[data-slot="page-sheet"]')].map((sheet) =>
        sheet.getAttribute("data-tone"),
      );
    expect(tones()).toEqual(["orange", "orange", "orange"]);

    rerender(<PageSheetFan tone={null} />);
    expect(tones()).toEqual(["purple", "purple", "purple"]);
  });

  it("writes 'Tu primera página' on the front sheet with a caret that rests under reduced motion", () => {
    const { container, getByText } = render(<PageSheetFan />);

    expect(getByText("Tu primera página")).toBeInTheDocument();
    expect(container.querySelector('[data-part="caret"]')).toHaveClass(
      "motion-safe:animate-pulse",
    );
  });
});
