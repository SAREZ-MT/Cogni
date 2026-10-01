import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TECHNIQUES_PANEL_COOKIE } from "../../../../../_components/techniques-panel-cookie";
import {
  TECHNIQUES_PANEL_SLOT_ID,
  TechniquesPanelSlot,
} from "../../../../../_components/techniques-panel-slot";
import { TechniquesPanel } from "./techniques-panel";

function clearCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom
  document.cookie = `${TECHNIQUES_PANEL_COOKIE}=; max-age=0; path=/`;
}

async function renderPanel(initialCollapsed: boolean) {
  const view = render(
    <>
      <TechniquesPanelSlot />
      <TechniquesPanel initialCollapsed={initialCollapsed} />
    </>,
  );
  // The panel resolves its portal target in an effect after mount.
  await act(async () => {});
  return view;
}

describe("TechniquesPanel", () => {
  beforeEach(clearCookie);

  it("portals into the layout slot, not inline", async () => {
    await renderPanel(false);

    const slot = document.getElementById(TECHNIQUES_PANEL_SLOT_ID);
    expect(slot).toContainElement(screen.getByTestId("techniques-panel"));
  });

  it("renders nothing when the slot does not exist", async () => {
    render(<TechniquesPanel initialCollapsed={false} />);
    await act(async () => {});

    expect(screen.queryByTestId("techniques-panel")).not.toBeInTheDocument();
  });

  it("lists the three techniques when expanded: Flashcards links to its screens, the others stay disabled", async () => {
    await renderPanel(false);

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.getByText("Active recall")).toBeInTheDocument();
    expect(screen.getByText("Examen")).toBeInTheDocument();
    for (const name of ["Iniciar", "Generar examen"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByRole("link", { name: "Ver mazos" })).toHaveAttribute(
      "href",
      "/flashcards",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("starts collapsed from the server-read cookie and offers to expand", async () => {
    await renderPanel(true);

    expect(screen.getByTestId("techniques-panel")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Expandir panel de técnicas" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Ver mazos")).not.toBeInTheDocument();
  });

  it("collapses on click and persists the choice in a cookie", async () => {
    const user = userEvent.setup();
    await renderPanel(false);

    await user.click(
      screen.getByRole("button", { name: "Colapsar panel de técnicas" }),
    );

    expect(screen.getByTestId("techniques-panel")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(document.cookie).toContain(`${TECHNIQUES_PANEL_COOKIE}=collapsed`);
  });

  it("expands again and persists 'expanded'", async () => {
    const user = userEvent.setup();
    await renderPanel(true);

    await user.click(
      screen.getByRole("button", { name: "Expandir panel de técnicas" }),
    );

    expect(screen.getByTestId("techniques-panel")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(document.cookie).toContain(`${TECHNIQUES_PANEL_COOKIE}=expanded`);
  });
});

describe("TechniquesPanelSlot", () => {
  it("renders an empty display:contents box so it takes no layout space", () => {
    const { container } = render(<TechniquesPanelSlot />);

    const slot = container.firstElementChild as HTMLElement;
    expect(slot.id).toBe(TECHNIQUES_PANEL_SLOT_ID);
    expect(slot).toHaveClass("contents");
    expect(slot).toBeEmptyDOMElement();
  });
});
