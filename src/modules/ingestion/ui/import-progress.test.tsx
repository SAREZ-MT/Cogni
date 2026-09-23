import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportProgress } from "./import-progress";
import { INGESTION_COPY, pagesOmittedMessage } from "./ingestion-copy";

// specs/design-tokens-and-shell/spec.md, "Requirement: Indicador de
// progreso de importación" — every scenario under this requirement.
describe("ImportProgress", () => {
  it.each([
    ["uploading", INGESTION_COPY.progress.uploading],
    ["queued", INGESTION_COPY.progress.queued],
    ["processing", INGESTION_COPY.progress.processing],
    ["done", INGESTION_COPY.progress.done],
  ] as const)("renders the %s state with its Spanish text (Scenario: Estados renderizados)", (state, text) => {
    render(<ImportProgress state={state} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("renders done with omitted pages using the real count (Scenario: Estados renderizados)", () => {
    render(<ImportProgress state="done" pagesWithoutText={3} />);
    expect(screen.getByText(pagesOmittedMessage(3))).toBeInTheDocument();
  });

  it("renders the job's error text for the failed state (Scenario: Estados renderizados)", () => {
    render(<ImportProgress state="failed" error="el PDF no tiene texto" />);
    expect(screen.getByText("el PDF no tiene texto")).toBeInTheDocument();
  });

  it("falls back to a generic message when failed has no error text", () => {
    render(<ImportProgress state="failed" />);
    expect(
      screen.getByText(INGESTION_COPY.progress.genericError),
    ).toBeInTheDocument();
  });

  it("exposes role=status with aria-live=polite for an active state (Scenario: Regiones accesibles)", () => {
    render(<ImportProgress state="processing" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("exposes role=alert for the failed state (Scenario: Regiones accesibles)", () => {
    render(<ImportProgress state="failed" error="algo falló" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("carries data-testid and data-status for the e2e suite", () => {
    render(<ImportProgress state="queued" />);
    const card = screen.getByTestId("import-progress");
    expect(card).toHaveAttribute("data-status", "queued");
  });

  it("never contains an inline hex color (Scenario: Ausencia de valores literales)", () => {
    const { container } = render(<ImportProgress state="done" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("uses motion-reduce:animate-none on the spinning icon (Scenario: Movimiento reducido)", () => {
    const { container } = render(<ImportProgress state="processing" />);
    const spinner = container.querySelector("svg");
    expect(spinner?.getAttribute("class")).toContain(
      "motion-reduce:animate-none",
    );
    expect(screen.getByText(INGESTION_COPY.progress.processing)).toBeVisible();
  });

  it("does not animate the static icon of the queued state", () => {
    const { container } = render(<ImportProgress state="queued" />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("class")).not.toContain("animate-spin");
  });

  it("shows the 90-second delay notice alongside an active state when delayed is true", () => {
    render(<ImportProgress state="processing" delayed />);
    expect(screen.getByText(INGESTION_COPY.progress.delay)).toBeInTheDocument();
  });

  it("does not show the delay notice for a terminal state even when delayed is true", () => {
    render(<ImportProgress state="done" delayed />);
    expect(
      screen.queryByText(INGESTION_COPY.progress.delay),
    ).not.toBeInTheDocument();
  });
});
