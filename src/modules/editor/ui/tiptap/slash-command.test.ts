import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  filterItems,
  SlashCommand,
  shouldCloseSlashMenu,
} from "./slash-command";
import type { SlashCommandItem } from "./slash-command-items";

// S7 fix (odd/tasks/app-shell-restyle.md): a browser probe found that
// @tiptap/suggestion's own Suggestion utility calls `render().onUpdate`
// TWICE per keystroke — once with a transient `items: []` snapshot taken
// BEFORE it re-evaluates the `items` option for the new query, then again
// once that resolves (console trace: `"encabezado " 0` -> `"encabezado " 3`
// -> `"encabezado 2" 0`). Deciding whether to close purely from
// `props.items` sees that transient empty call and exits the suggestion
// even though "Encabezado 2" matches, which is the exact regression the
// allowSpaces fix was meant to prevent. This mocks @tiptap/suggestion
// itself (never a real Suggestion plugin) to capture the `render()` object
// SlashCommand builds and drive it directly with fabricated props,
// independent of the module's internal double-call timing.
interface FakeSuggestionProps {
  query: string;
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  mount?: (element: HTMLElement) => (() => void) | undefined;
}

interface SuggestionRenderHandlers {
  onStart: (props: FakeSuggestionProps) => void;
  onUpdate: (props: FakeSuggestionProps) => void;
  onExit: (props: FakeSuggestionProps) => void;
}

interface SuggestionCapture {
  render: () => SuggestionRenderHandlers;
}

const { exitSuggestion, capturedConfig } = vi.hoisted(() => ({
  exitSuggestion: vi.fn(),
  capturedConfig: { current: undefined as SuggestionCapture | undefined },
}));

vi.mock("@tiptap/suggestion", () => ({
  default: vi.fn((config: unknown) => {
    capturedConfig.current = config as SuggestionCapture;
    // Never registered as a real ProseMirror plugin in these tests — only
    // its captured `config` (specifically `render()`) is driven directly.
    return {};
  }),
  exitSuggestion,
}));

// S7 (odd/tasks/app-shell-restyle.md, drift #3): the "/" menu used to
// close the moment a space was typed (`@tiptap/suggestion`'s default
// `allowSpaces: false`), so writing "/encabezado 2" or "/lista con" never
// matched anything by the time Enter was pressed. `filterItems` itself
// already matches on a full substring of label + keywords (unchanged
// here); these cases prove a multi-word query still resolves once spaces
// are allowed through.
describe("filterItems", () => {
  it('matches "encabezado 2" to Encabezado 2', () => {
    const results = filterItems("encabezado 2");
    expect(results[0]?.label).toBe("Encabezado 2");
  });

  it('matches "lista con" to Lista con viñetas', () => {
    const results = filterItems("lista con");
    expect(results[0]?.label).toBe("Lista con viñetas");
  });

  it('still matches single-word queries ("/cita", "/tabla", "/advertencia")', () => {
    expect(filterItems("cita")[0]?.label).toBe("Cita");
    expect(filterItems("tabla")[0]?.label).toBe("Tabla");
    expect(filterItems("advertencia")[0]?.label).toBe("Callout de advertencia");
  });
});

// S7 drift #3: allowing spaces through means a normal sentence typed right
// after "/" ("/vamos a estudiar biología") must not leave an empty,
// useless menu open forever. `shouldCloseSlashMenu` is the pure exit rule
// wired into the Suggestion's onUpdate (via @tiptap/suggestion's
// exitSuggestion) — it only fires once nothing matches AND the query looks
// like prose (a space, or long), never while a real command still could.
describe("shouldCloseSlashMenu", () => {
  const noItems: SlashCommandItem[] = [];
  const someItems = filterItems("cita");

  it("never closes while there is at least one matching item", () => {
    expect(shouldCloseSlashMenu("cita", someItems)).toBe(false);
    expect(shouldCloseSlashMenu("encabezado 2", someItems)).toBe(false);
  });

  it("stays open for a short, still-plausible prefix with no matches yet", () => {
    expect(shouldCloseSlashMenu("enc", noItems)).toBe(false);
    expect(shouldCloseSlashMenu("xyz", noItems)).toBe(false);
  });

  it("closes once the empty-match query contains a space (ordinary prose)", () => {
    expect(shouldCloseSlashMenu("vamos a", noItems)).toBe(true);
  });

  it("closes once the empty-match query grows past a reasonable command length", () => {
    expect(shouldCloseSlashMenu("unapalabramuylarga", noItems)).toBe(true);
  });
});

// S7 fix: exercises the actual `render()` object SlashCommand's
// `addProseMirrorPlugins()` builds, driven directly with fabricated props
// (never a real @tiptap/suggestion plugin, which is fully mocked above),
// so the module's own internal double-onUpdate timing never has to be
// reproduced to prove the fix.
describe("SlashCommand's onUpdate close decision", () => {
  function startSuggestion() {
    capturedConfig.current = undefined;
    exitSuggestion.mockClear();

    const fakeEditor = { view: {} };
    const addProseMirrorPlugins = SlashCommand.config.addProseMirrorPlugins as
      | ((this: { editor: typeof fakeEditor }) => unknown)
      | undefined;
    addProseMirrorPlugins?.call({ editor: fakeEditor });

    // A direct assertion instead of an `if (!capture) throw` guard: TS
    // cannot see that the opaque `addProseMirrorPlugins?.call(...)` above
    // is what populates `capturedConfig.current` (it was reset to
    // `undefined` above), so a control-flow guard here narrows to `never`
    // instead of `SuggestionCapture`.
    expect(capturedConfig.current).toBeDefined();
    const capture = capturedConfig.current as unknown as SuggestionCapture;
    const handlers = capture.render();

    let mountedElement: HTMLElement | null = null;
    // `renderMenu` (slash-command.tsx) calls `root.render(...)` outside of
    // any React event handler, so it needs an explicit `act()` here (just
    // as @testing-library/react's own `render`/`fireEvent` do internally)
    // for the commit to actually flush before this function returns.
    act(() => {
      handlers.onStart({
        query: "",
        items: filterItems(""),
        command: vi.fn(),
        mount: (element) => {
          mountedElement = element;
          return () => {};
        },
      });
    });

    return { handlers, getMountedElement: () => mountedElement };
  }

  it("does not exit the suggestion on the transient empty-items call when the query actually matches (R3-onupdate-transient-empty-items)", () => {
    const { handlers, getMountedElement } = startSuggestion();

    // @tiptap/suggestion's own transient pre-resolution call: `items: []`
    // even though "encabezado 2" really matches "Encabezado 2".
    act(() => {
      handlers.onUpdate({
        query: "encabezado 2",
        items: [],
        command: vi.fn(),
      });
    });

    expect(exitSuggestion).not.toHaveBeenCalled();
    expect(
      getMountedElement()?.querySelector('[data-testid="command-menu"]'),
    ).not.toBeNull();
  });

  it("still exits once the query truly matches nothing and looks like prose", () => {
    const { handlers } = startSuggestion();

    act(() => {
      handlers.onUpdate({
        query: "vamos a estudiar",
        items: [],
        command: vi.fn(),
      });
    });

    expect(exitSuggestion).toHaveBeenCalledTimes(1);
  });
});
