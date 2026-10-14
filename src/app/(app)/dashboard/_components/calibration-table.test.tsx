import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CalibrationRow, CalibrationZone } from "../_lib/dashboard-view";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { CalibrationTable } from "./calibration-table";

function calRow(
  id: string,
  pageTitle: string,
  selfAvg: number,
  aiAvg: number,
  zone: CalibrationZone,
): CalibrationRow {
  return {
    id,
    pageTitle,
    notebookTitle: "Biología",
    selfAvg,
    aiAvg,
    gap: Math.round((selfAvg - aiAvg) * 10) / 10,
    zone,
    href: `/active-recall/nb-1/${id}`,
  };
}

// Seven pages (two table pages). The zone is each page's most frequent
// per-answer signal, so it may disagree with the averages (Ribosomas).
const ROWS: CalibrationRow[] = [
  calRow("p-clo", "Cloroplasto", 5, 1, "exceso"),
  calRow("p-nuc", "Núcleo", 1, 5, "falta"),
  calRow("p-mit", "Mitocondria", 4, 4, "calibrado"),
  calRow("p-rib", "Ribosomas", 3.5, 3, "exceso"),
  calRow("p-mem", "Membrana", 3, 3.5, "calibrado"),
  calRow("p-ser", "Series de Taylor", 2, 2, "calibrado"),
  calRow("p-apo", "Apoptosis", 2.5, 1.5, "calibrado"),
];

function renderTable(rows: readonly CalibrationRow[] = ROWS) {
  return render(<CalibrationTable rows={rows} />);
}

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
    renderTable();

    expect(
      screen.getByRole("heading", { name: "Calibración metacognitiva" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: /autoevaluación promedio/ }),
    ).toBeInTheDocument();
  });

  it("starts sorted by the gap, largest first", () => {
    renderTable();

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
    renderTable();

    const row = screen.getByRole("row", { name: /Cloroplasto/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("5");
    expect(cells[2]).toHaveTextContent("1");
    expect(cells[3]).toHaveTextContent("+4");
    expect(within(row).getByText("Exceso de confianza")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Repasar" })).toHaveAttribute(
      "href",
      "/active-recall/nb-1/p-clo",
    );
  });

  it("tones the signal pill by calibration zone", async () => {
    const user = userEvent.setup();
    renderTable();

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
    renderTable();

    await user.click(screen.getByRole("button", { name: "Brecha" }));

    expect(header("Brecha")).toHaveAttribute("aria-sort", "ascending");
    expect(pageTitles()[0]).toBe("Núcleo");
    expect(
      within(screen.getAllByRole("row")[1]).getAllByRole("cell")[3],
    ).toHaveTextContent("−4".replace("−", "-"));
  });

  it("sorts a new column descending, and the title column alphabetically", async () => {
    const user = userEvent.setup();
    renderTable();

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
    renderTable();

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
    renderTable();

    expect(screen.getByText("1–5 de 7")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("6–7 de 7")).toBeInTheDocument();
    expect(pageTitles()).toHaveLength(2);
    expect(pageTitles()).not.toContain("Cloroplasto");

    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(screen.getByText("1–5 de 7")).toBeInTheDocument();
  });

  it("stops at the last page, which holds the remainder", async () => {
    const user = userEvent.setup();
    renderTable();

    const next = screen.getByRole("button", { name: "Página siguiente" });
    await user.click(next);

    expect(screen.getByText("6–7 de 7")).toBeInTheDocument();
    expect(pageTitles()).toHaveLength(2);
    expect(next).toBeDisabled();
  });

  it("returns to the first page when the sort changes", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await user.click(screen.getByRole("button", { name: "Página" }));

    expect(screen.getByText("1–5 de 7")).toBeInTheDocument();
  });

  it("takes the signal from the answers, not from the averages", () => {
    renderTable();

    const row = screen.getByRole("row", { name: /Ribosomas/ });
    expect(within(row).getByText("Exceso de confianza")).toBeInTheDocument();
  });

  it("maps the analytics rows with rounded averages", () => {
    renderTable(sampleView().calibration);

    const row = screen.getByRole("row", { name: /Renacimiento/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("3,7");
    expect(cells[2]).toHaveTextContent("2,3");
    expect(cells[3]).toHaveTextContent("+1,4");
  });

  it("shows an empty state without evaluated answers in the period", () => {
    renderTable([]);

    expect(
      screen.getByText("Sin autoevaluaciones en este período"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
