import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandMenu } from "./command-menu";

const ITEMS = [
  { id: "heading1", label: "encabezado 1", keywords: ["h1", "titulo"] },
  { id: "paragraph", label: "párrafo" },
  { id: "blockquote", label: "cita" },
];

// specs/editor/spec.md, "Menú de comandos `/`", Scenarios "Filtro sin
// resultados" and "Cierre con Escape".
describe("CommandMenu", () => {
  it("shows a no-results message and Enter inserts nothing when the filter matches no block", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={ITEMS}
        query="zzz-no-existe"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("no se encontraron bloques")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape without calling onSelect, leaving the caller to keep the / character", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={ITEMS}
        query=""
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("filters by label and selects the highlighted item on Enter", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={ITEMS}
        query="cita"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("cita")).toBeInTheDocument();
    expect(screen.queryByText("párrafo")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "blockquote" }),
    );
  });

  it("moves the selection with arrow keys before confirming with Enter", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={ITEMS}
        query=""
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "paragraph" }),
    );
  });
});
