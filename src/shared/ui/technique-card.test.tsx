import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import {
  TECHNIQUE_ACCENT_CLASS,
  TECHNIQUE_ACCENT_TEXT_CLASS,
  TechniqueCard,
  TechniqueIconStrip,
  TechniqueStack,
} from "./technique-card";

describe("TechniqueCard", () => {
  function renderCard(
    props: Partial<React.ComponentProps<typeof TechniqueCard>> = {},
  ) {
    return render(
      <TechniqueCard
        icon={Layers}
        tone="yellow"
        name="Flashcards"
        {...props}
      />,
    );
  }

  // H9-T1 (user, 2026-10-29): a tile is only icon + name + Generar + the
  // remaining generations; there is no description line.
  it("shows only the icon, the name and the action: no description line", () => {
    const { container } = renderCard();

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(
      container.querySelector("[data-part=technique-icon]"),
    ).not.toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  // H9-T2 (user, 2026-10-29): icon and name form one row, the name a
  // larger one-line title; "Generar" sits below that row.
  it("puts the icon and a one-line name in one row above the button", () => {
    const { container } = renderCard({ onGenerate: () => {} });

    const tile = container.querySelector("[data-part=technique-icon]");
    const name = screen.getByText("Flashcards");
    expect(name.parentElement).toBe(tile?.parentElement);
    expect(name).toHaveClass("truncate", "text-[15px]");
    expect(
      name.compareDocumentPosition(
        screen.getByRole("button", { name: "Generar" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
          tone="yellow"
          name="Flashcards"
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

describe("TechniqueCard technique colours", () => {
  // H9-T2 (user, 2026-10-29): the Home "Tu progreso de hoy" look — a white
  // card with the technique's pastel fading in from the icon corner
  // (globals.css technique-glow-*), the pastel icon tile, and a "Generar"
  // in the technique's pastel pair.
  const SHARED = ["w-full", "h-9", "text-[13px]", "font-semibold"];
  it.each([
    ["yellow", "pastel-yellow"],
    ["green", "pastel-mint"],
    ["rose", "pastel-pink"],
  ] as const)("colours a %s tile, its icon and its Generar with the %s pair", (tone, pair) => {
    const { container } = render(
      <TechniqueCard
        icon={Layers}
        tone={tone}
        name="n"
        onGenerate={() => {}}
      />,
    );

    const card = container.querySelector("[data-part=technique-card]");
    expect(card).toHaveAttribute("data-tone", tone);
    expect(card).toHaveClass(
      "bg-card",
      `technique-glow-${pair.replace("pastel-", "")}`,
    );
    const button = screen.getByRole("button", { name: "Generar" });
    expect(button).toHaveClass(...SHARED, `bg-${pair}`, `text-${pair}-fg`);
    expect(button.className).not.toMatch(
      /text-white|bg-(warning|success|rose)-\d/,
    );
    const tile = container.querySelector("[data-part=technique-icon]");
    expect(tile).toHaveClass("size-9", `bg-${pair}`, `text-${pair}-fg`);
  });

  it("gives the three Generar buttons the same classes apart from the colour pair", () => {
    const classesOf = (tone: "yellow" | "green" | "rose") => {
      const { unmount } = render(
        <TechniqueCard
          icon={Layers}
          tone={tone}
          name={tone}
          onGenerate={() => {}}
        />,
      );
      const classes = screen
        .getByRole("button", { name: "Generar" })
        .className.split(" ")
        .filter((c) => !/pastel-/.test(c))
        .sort();
      unmount();
      return classes;
    };

    expect(classesOf("green")).toEqual(classesOf("yellow"));
    expect(classesOf("rose")).toEqual(classesOf("yellow"));
  });
});

describe("TechniqueStack", () => {
  it("draws one decorative layer per technique colour, hidden from assistive tech", () => {
    const { container } = render(<TechniqueStack />);

    const stack = container.firstElementChild;
    expect(stack).toHaveAttribute("aria-hidden", "true");
    const layers = container.querySelectorAll("[data-part=technique-layer]");
    expect([...layers].map((l) => l.getAttribute("data-tone"))).toEqual([
      "rose",
      "green",
      "yellow",
    ]);
  });
});

describe("TechniqueIconStrip", () => {
  it("exposes the technique name as a tooltip title", () => {
    render(
      <TechniqueIconStrip
        icon={Layers}
        tone="green"
        title="Recordación activa"
      />,
    );

    expect(screen.getByTitle("Recordación activa")).toBeInTheDocument();
  });

  it("uses the technique's pastel tile, at 40px so it reads when collapsed (H9-T2)", () => {
    render(<TechniqueIconStrip icon={Layers} tone="yellow" title="t" />);

    expect(screen.getByTitle("t")).toHaveClass("bg-pastel-yellow", "size-10");
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

describe("TECHNIQUE_ACCENT_CLASS / TECHNIQUE_ACCENT_TEXT_CLASS", () => {
  // Accents for bars, dots, fills and ring strokes (user decisions
  // 2026-10-19: pastel yellow and mint, a solid vivid red for Examen).
  it("maps every technique tone to its accent as a fill and as a text colour", () => {
    expect(TECHNIQUE_ACCENT_CLASS).toEqual({
      yellow: "bg-technique-flashcards-accent",
      green: "bg-technique-recall-accent",
      rose: "bg-technique-exam-accent",
    });
    expect(TECHNIQUE_ACCENT_TEXT_CLASS).toEqual({
      yellow: "text-technique-flashcards-accent",
      green: "text-technique-recall-accent",
      rose: "text-technique-exam-accent",
    });
  });
});
