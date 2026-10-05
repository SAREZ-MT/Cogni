import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { TechniqueCard, TechniqueIconStrip } from "./technique-card";

describe("TechniqueCard", () => {
  function renderCard(props: { disabled?: boolean } = {}) {
    return render(
      <TechniqueCard
        icon={Layers}
        tone="primary"
        name="Flashcards"
        description="Tarjetas con repetición espaciada"
        {...props}
      />,
    );
  }

  it("shows the name and description", () => {
    renderCard();

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(
      screen.getByText("Tarjetas con repetición espaciada"),
    ).toBeInTheDocument();
  });

  it("offers a single 'Generar' action that is disabled and flagged as coming soon by default", () => {
    renderCard();

    const action = screen.getByRole("button", { name: "Generar" });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(action).toHaveAttribute("title", "Disponible pronto");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("enables the action once the technique is wired up", () => {
    renderCard({ disabled: false });

    const action = screen.getByRole("button", { name: "Generar" });
    expect(action).toBeEnabled();
    expect(action).not.toHaveAttribute("title");
  });

  describe("wired to an action", () => {
    function renderWired(
      props: Partial<React.ComponentProps<typeof TechniqueCard>> = {},
    ) {
      return render(
        <TechniqueCard
          icon={Layers}
          tone="primary"
          name="Flashcards"
          description="d"
          onGenerate={() => {}}
          {...props}
        />,
      );
    }

    it("is enabled by default and calls onGenerate on click", async () => {
      const onGenerate = vi.fn();
      renderWired({ onGenerate });

      const action = screen.getByRole("button", { name: "Generar" });
      expect(action).toBeEnabled();
      expect(action).not.toHaveAttribute("title");
      await userEvent.click(action);

      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it("shows a busy, disabled 'Generando…' button while pending", async () => {
      const onGenerate = vi.fn();
      renderWired({ onGenerate, pending: true });

      const action = screen.getByRole("button", { name: "Generando…" });
      expect(action).toBeDisabled();
      expect(action).toHaveAttribute("aria-busy", "true");
      await userEvent.click(action);
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("stays disabled without the 'coming soon' hint when the caller disables it", () => {
      renderWired({ disabled: true });

      const action = screen.getByRole("button", { name: "Generar" });
      expect(action).toBeDisabled();
      expect(action).not.toHaveAttribute("title");
    });

    it("forwards a test id to the button and renders children below it", () => {
      renderWired({
        generateTestId: "generate-flashcards",
        children: <p>Te quedan 4 generaciones hoy</p>,
      });

      expect(screen.getByTestId("generate-flashcards")).toBe(
        screen.getByRole("button", { name: "Generar" }),
      );
      expect(
        screen.getByText("Te quedan 4 generaciones hoy"),
      ).toBeInTheDocument();
    });

    it("renders controls above the button and children below it", () => {
      renderWired({
        controls: <p>Controles</p>,
        children: <p>Debajo</p>,
      });

      const button = screen.getByRole("button", { name: "Generar" });
      const controls = screen.getByText("Controles");
      const below = screen.getByText("Debajo");
      expect(
        controls.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        button.compareDocumentPosition(below) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("is not a link: generating never navigates to a route that may not exist", () => {
    renderCard();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("pronto")).not.toBeInTheDocument();
  });
});

describe("TechniqueIconStrip", () => {
  it("exposes the technique name as a tooltip title", () => {
    render(
      <TechniqueIconStrip icon={Layers} tone="green" title="Active recall" />,
    );

    expect(screen.getByTitle("Active recall")).toBeInTheDocument();
  });

  it("is dimmed unless the technique is available", () => {
    const { rerender } = render(
      <TechniqueIconStrip icon={Layers} tone="green" title="t" />,
    );
    expect(screen.getByTitle("t")).toHaveClass("opacity-35");

    rerender(
      <TechniqueIconStrip icon={Layers} tone="green" title="t" available />,
    );
    expect(screen.getByTitle("t")).not.toHaveClass("opacity-35");
  });
});
