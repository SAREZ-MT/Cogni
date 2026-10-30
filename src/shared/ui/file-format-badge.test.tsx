import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileFormatBadge } from "./file-format-badge";

describe("FileFormatBadge", () => {
  it.each([
    ["pdf", "PDF", "bg-pastel-pink"],
    ["docx", "DOCX", "bg-pastel-blue"],
    ["pptx", "PPTX", "bg-pastel-orange"],
  ] as const)("labels %s as %s on its pastel", (format, label, tone) => {
    render(<FileFormatBadge format={format} />);

    const badge = screen.getByText(label);
    expect(badge).toHaveAttribute("data-format", format);
    expect(badge).toHaveClass(tone);
  });
});
