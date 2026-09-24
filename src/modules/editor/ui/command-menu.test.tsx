import { fireEvent, render, screen, within } from "@testing-library/react";
import { Heading1, Quote } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { CommandMenu } from "./command-menu";

const ITEMS = [
  { id: "heading1", label: "encabezado 1", keywords: ["h1", "titulo"] },
  { id: "paragraph", label: "párrafo" },
  { id: "blockquote", label: "cita" },
];

// S6a (odd/tasks/app-shell-restyle.md): the same list, but declaring the
// icon/group/description fields the restyled menu renders.
const GROUPED_ITEMS = [
  {
    id: "heading1",
    label: "encabezado 1",
    keywords: ["h1", "titulo"],
    icon: Heading1,
    group: "Básicos",
    description: "Título grande de sección",
  },
  {
    id: "paragraph",
    label: "párrafo",
    icon: Heading1,
    group: "Básicos",
  },
  {
    id: "blockquote",
    label: "cita",
    icon: Quote,
    group: "Bloques",
  },
];

// specs/editor/spec.md, "Menú de comandos `/`", Scenarios "Filtro sin
// resultados" and "Cierre con Escape".
// S6a review follow-up (R3-grouped-order-divergence, folded into S6b):
// items whose group values are NOT already contiguous (unlike the real
// SLASH_COMMAND_ITEMS, which IS contiguous by construction) exposed a
// divergence between the flat `filtered` array `selectedIndex` walked and
// the bucketed-by-group order actually rendered.
const INTERLEAVED_GROUPED_ITEMS = [
  { id: "a1", label: "Elemento A1", group: "Grupo A" },
  { id: "b1", label: "Elemento B1", group: "Grupo B" },
  { id: "a2", label: "Elemento A2", group: "Grupo A" },
];

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

  // PR5b finding (flagged as advisory in PR3b): cmdk's own CommandItem
  // recomputes `data-selected` from its internal pointer/value state after
  // rendering, always overwriting a consumer-supplied `data-selected` prop
  // (node_modules/cmdk/dist/index.mjs spreads `...props` before setting its
  // own `data-selected`). The visual highlight therefore never followed
  // ArrowDown navigation.
  //
  // S6a: `data-selected` lives on the cmdk item (`[data-slot="command-
  // item"]`), not on the label text node any more now that the label sits
  // inside a nested span alongside the optional description — a legitimate
  // DOM change from grouping/icon tiles, so this walks up to that ancestor
  // instead of asserting on the text node directly.
  function commandItemFor(text: string) {
    const node = screen.getByText(text);
    const item = node.closest('[data-slot="command-item"]');
    if (!item) throw new Error(`no command item ancestor for "${text}"`);
    return item;
  }

  it("visually highlights the item selected by ArrowDown, not only the initial one", () => {
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

    expect(commandItemFor("encabezado 1")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(commandItemFor("párrafo")).toHaveAttribute("data-selected", "false");

    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(commandItemFor("párrafo")).toHaveAttribute("data-selected", "true");
    expect(commandItemFor("encabezado 1")).toHaveAttribute(
      "data-selected",
      "false",
    );
  });

  // Browser bug found on 115cca9: cmdk always sets a `data-selected`
  // attribute, `"true"` on the active row and `"false"` on every other one
  // (never removed). Tailwind's bare `data-selected:` variant compiles to
  // the attribute-PRESENCE selector `[data-selected]`, which matches
  // `data-selected="false"` too, so every row rendered as active. The fix
  // is the value-scoped `data-[selected=true]:` variant, compiling to
  // `[data-selected="true"]`. jsdom never runs the real Tailwind build, so
  // this can't assert the rendered color directly — it asserts the
  // className carries the value-scoped token (not the old presence-only
  // one), and, using the DOM's own CSS selector matching, that only the
  // item cmdk marked `data-selected="true"` actually matches that
  // selector while its sibling does not.
  it("uses the value-scoped data-selected variant so only the truly selected item gets the active classes", () => {
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

    const selected = commandItemFor("encabezado 1");
    const sibling = commandItemFor("párrafo");

    expect(selected.className).toMatch(/data-\[selected=true\]:bg-active/);
    expect(selected.className).not.toMatch(
      /(^|\s)data-selected:bg-active(\s|$)/,
    );

    expect(selected.matches('[data-selected="true"]')).toBe(true);
    expect(sibling.matches('[data-selected="true"]')).toBe(false);
  });

  // S6a (odd/tasks/app-shell-restyle.md), Editor directive: the restyled
  // "/" menu groups items under a heading and shows an icon tile per item,
  // matching the Tiptap docs Notion-style editor.
  it("renders a group heading and an icon tile for items that declare them", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={GROUPED_ITEMS}
        query=""
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Básicos")).toBeInTheDocument();
    expect(screen.getByText("Bloques")).toBeInTheDocument();
    expect(
      screen.getByTestId("command-menu-item-icon-heading1"),
    ).toBeInTheDocument();
    expect(screen.getByText("Título grande de sección")).toBeInTheDocument();
  });

  it("keeps the grouped order stable, matching each group's first appearance", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={GROUPED_ITEMS}
        query=""
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    const headings = screen.getAllByText(/^(Básicos|Bloques)$/);
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Básicos",
      "Bloques",
    ]);
  });

  it("still selects a grouped item by id on Enter", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={GROUPED_ITEMS}
        query="cita"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "blockquote" }),
    );
  });

  // S6a review follow-up (R3-grouped-order-divergence, folded into S6b):
  // keyboard `selectedIndex` must walk the same bucketed-by-group order as
  // rendering, not the flat pre-filter order, so ArrowDown always
  // highlights the item that is visually right below the current one —
  // even when that means crossing a group boundary because the source
  // data interleaves groups.
  it("walks the rendered (bucketed-by-group) order with ArrowDown, not the flat pre-filter order", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        items={INTERLEAVED_GROUPED_ITEMS}
        query=""
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    // Rendered order (bucketed by first appearance): Grupo A [a1, a2],
    // then Grupo B [b1] -> a1, a2, b1. The flat pre-filter order was
    // a1, b1, a2 -- if selectedIndex walked that instead, the first
    // ArrowDown would highlight "Elemento B1", not "Elemento A2".
    expect(commandItemFor("Elemento A1")).toHaveAttribute(
      "data-selected",
      "true",
    );

    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(commandItemFor("Elemento A2")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(commandItemFor("Elemento B1")).toHaveAttribute(
      "data-selected",
      "false",
    );

    // Second ArrowDown now crosses the group boundary into "Grupo B".
    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(commandItemFor("Elemento B1")).toHaveAttribute(
      "data-selected",
      "true",
    );

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b1" }),
    );
  });

  it("renders without a group heading for items that omit it, as before", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <CommandMenu
        items={ITEMS}
        query=""
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(within(container).getByText("cita")).toBeInTheDocument();
    expect(container.querySelector("[cmdk-group-heading]")).toBeNull();
  });
});
