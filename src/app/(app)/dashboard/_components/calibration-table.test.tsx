import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CalibrationTable } from "./calibration-table";

// Row page titles in display order (first column), header row excluded.
function pageTitles(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map(
      (row) =>
        within(row).getAllByRole("cell")[0].querySelector("p")?.textContent ??
        "",
    );
}

function header(name: RegExp | string) {
  return screen.getByRole("columnheader", { name });
}

describe("CalibrationTable", () => {
  it("explains what is compared and names the table for screen readers", () => {
    render(<CalibrationTable />);

    expect(
      screen.getByRole("heading", { name: "Calibración metacognitiva" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: /autoevaluación promedio/ }),
    ).toBeInTheDocument();
  });

  it("starts sorted by the gap, largest first", () => {
    render(<CalibrationTable />);

    const gaps = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        Number(
          within(row)
            .getAllByRole("cell")[3]
            .textContent?.replace("+", "")
            .replace(",", "."),
        ),
      );
    expect(pageTitles()[0]).toBe("Cloroplasto");
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    expect(gaps[0]).toBe(4);
    expect(header("Brecha")).toHaveAttribute("aria-sort", "descending");
    expect(header("Página")).toHaveAttribute("aria-sort", "none");
  });

  it("shows averages, signed gap and the calibration signal of a row", () => {
    render(<CalibrationTable />);

    const row = screen.getByRole("row", { name: /Cloroplasto/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("5");
    expect(cells[2]).toHaveTextContent("1");
    expect(cells[3]).toHaveTextContent("+4");
    expect(within(row).getByText("Exceso de confianza")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Repasar" })).toHaveAttribute(
      "href",
      "/active-recall/biologia-celular/cloroplasto",
    );
  });

  it("tones the signal pill by calibration zone", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    for (const pill of screen.getAllByText("Exceso de confianza", {
      selector: "span",
    })) {
      expect(pill).toHaveClass("bg-warning-100");
    }
    // Sorted by the gap ascending, the underconfident rows lead.
    await user.click(screen.getByRole("button", { name: "Brecha" }));
    for (const pill of screen.getAllByText("Falta de confianza", {
      selector: "span",
    })) {
      expect(pill).toHaveClass("bg-info-100");
    }
    for (const pill of screen.getAllByText("Calibrado", { selector: "span" })) {
      expect(pill).toHaveClass("bg-success-100");
    }
  });

  it("toggles the same column between descending and ascending", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    await user.click(screen.getByRole("button", { name: "Brecha" }));

    expect(header("Brecha")).toHaveAttribute("aria-sort", "ascending");
    expect(pageTitles()[0]).toBe("Núcleo");
    expect(
      within(screen.getAllByRole("row")[1]).getAllByRole("cell")[3],
    ).toHaveTextContent("−4".replace("−", "-"));
  });

  it("sorts a new column descending, and the title column alphabetically", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    await user.click(screen.getByRole("button", { name: "Página" }));
    expect(header("Página")).toHaveAttribute("aria-sort", "descending");
    expect(header("Brecha")).toHaveAttribute("aria-sort", "none");
    expect(pageTitles()[0]).toBe("Series de Taylor");

    await user.click(screen.getByRole("button", { name: "Página" }));
    expect(header("Página")).toHaveAttribute("aria-sort", "ascending");
    expect(pageTitles()[0]).toBe("Apoptosis");
  });

  it("sorts by self-assessment and by real result", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    await user.click(screen.getByRole("button", { name: "Autoevaluación" }));
    expect(header("Autoevaluación")).toHaveAttribute("aria-sort", "descending");
    const selfTop = within(screen.getAllByRole("row")[1]).getAllByRole(
      "cell",
    )[1];
    expect(selfTop).toHaveTextContent("5");

    await user.click(screen.getByRole("button", { name: "Resultado real" }));
    const aiTop = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[2];
    expect(aiTop).toHaveTextContent("5");
  });

  it("paginates five rows at a time and reports the visible range", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    expect(screen.getByText("1–5 de 19")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("6–10 de 19")).toBeInTheDocument();
    expect(pageTitles()).toHaveLength(5);
    expect(pageTitles()).not.toContain("Cloroplasto");

    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(screen.getByText("1–5 de 19")).toBeInTheDocument();
  });

  it("stops at the last page, which holds the remainder", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    const next = screen.getByRole("button", { name: "Página siguiente" });
    await user.click(next);
    await user.click(next);
    await user.click(next);

    expect(screen.getByText("16–19 de 19")).toBeInTheDocument();
    expect(pageTitles()).toHaveLength(4);
    expect(next).toBeDisabled();
  });

  it("returns to the first page when the sort changes", async () => {
    const user = userEvent.setup();
    render(<CalibrationTable />);

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await user.click(screen.getByRole("button", { name: "Página" }));

    expect(screen.getByText("1–5 de 19")).toBeInTheDocument();
  });
});
