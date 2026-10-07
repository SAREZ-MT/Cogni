import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoiceGroup } from "./choice-group";

const OPTIONS = [
  { value: "ai", label: "Generar con IA", description: "La IA las crea" },
  { value: "manual", label: "Crear mis preguntas", description: "Tú escribes" },
] as const;

describe("ChoiceGroup", () => {
  it("is a labelled radio group with one checked option", () => {
    render(
      <ChoiceGroup
        aria-label="Cómo crearlo"
        options={OPTIONS}
        value="ai"
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Cómo crearlo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Generar con IA/ })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Crear mis preguntas/ }),
    ).not.toBeChecked();
    expect(screen.getByText("Tú escribes")).toBeInTheDocument();
  });

  it("reports the option the student picks", async () => {
    const onChange = vi.fn();
    render(
      <ChoiceGroup
        aria-label="x"
        options={OPTIONS}
        value="ai"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: /Crear mis/ }));

    expect(onChange).toHaveBeenCalledWith("manual");
  });

  it("marks the checked option with the selected style and forwards test ids", () => {
    render(
      <ChoiceGroup
        aria-label="x"
        options={OPTIONS}
        value="manual"
        onChange={() => {}}
        testId="create-mode"
      />,
    );

    expect(screen.getByTestId("create-mode-manual")).toHaveClass(
      "border-rose-500",
    );
    expect(screen.getByTestId("create-mode-ai")).not.toHaveClass(
      "border-rose-500",
    );
  });
});
