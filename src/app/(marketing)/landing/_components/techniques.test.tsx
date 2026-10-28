import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const view = vi.hoisted(() => ({ inView: false, reduced: false }));

// The deck's autoplay only runs while the section is in view and motion is
// allowed; both inputs are controlled here so the timing is deterministic.
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useInView: () => view.inView,
  useReducedMotion: () => view.reduced,
}));

import { Techniques } from "./techniques";

// jsdom has no IntersectionObserver; the shared Reveal (whileInView) needs
// one to mount. It never fires, which is all these tests need.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

const NAMES = [
  "Flashcards",
  "Recuperación activa",
  "Exámenes",
  "La IA prepara, tú decides",
];

function panels() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-part="technique-card"]'),
  );
}

function frontPanel() {
  const live = panels().filter((panel) => !panel.hasAttribute("inert"));
  expect(live).toHaveLength(1);
  return live[0];
}

beforeEach(() => {
  view.inView = false;
  view.reduced = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Techniques", () => {
  it("renders the four techniques as tabs with the first one selected", () => {
    render(<Techniques />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(NAMES);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
  });

  it("links each tab to its card and keeps only the front card out of inert", () => {
    render(<Techniques />);

    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      const panel = document.getElementById(
        tab.getAttribute("aria-controls") ?? "",
      );
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }
    expect(panels()).toHaveLength(4);
    expect(frontPanel()).toHaveAccessibleName("Flashcards");
  });

  it("brings the clicked technique to the front", async () => {
    const user = userEvent.setup();
    render(<Techniques />);

    await user.click(screen.getByRole("tab", { name: "Exámenes" }));

    expect(screen.getByRole("tab", { name: "Exámenes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(frontPanel()).toHaveAccessibleName("Exámenes");
    expect(frontPanel()).toHaveTextContent("Opción A");
  });

  it("moves selection and focus with the arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    render(<Techniques />);
    const tabs = () => screen.getAllByRole("tab");

    await user.click(tabs()[0]);
    await user.keyboard("{ArrowRight}");
    expect(tabs()[1]).toHaveFocus();
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(tabs()[3]).toHaveFocus();
    expect(frontPanel()).toHaveAccessibleName("La IA prepara, tú decides");

    await user.keyboard("{Home}");
    expect(tabs()[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
  });

  it("autoplays every five seconds only while in view", () => {
    vi.useFakeTimers();
    view.inView = true;
    render(<Techniques />);

    act(() => vi.advanceTimersByTime(5000));
    expect(frontPanel()).toHaveAccessibleName("Recuperación activa");
    act(() => vi.advanceTimersByTime(5000));
    expect(frontPanel()).toHaveAccessibleName("Exámenes");
  });

  it("does not autoplay out of view, on hover or with reduced motion", () => {
    vi.useFakeTimers();
    const { unmount } = render(<Techniques />);
    act(() => vi.advanceTimersByTime(12000));
    expect(frontPanel()).toHaveAccessibleName("Flashcards");
    unmount();

    view.inView = true;
    render(<Techniques />);
    fireEvent.pointerEnter(screen.getByTestId("technique-deck"));
    act(() => vi.advanceTimersByTime(12000));
    expect(frontPanel()).toHaveAccessibleName("Flashcards");
  });

  it("does not autoplay under reduced motion", () => {
    vi.useFakeTimers();
    view.inView = true;
    view.reduced = true;
    render(<Techniques />);

    act(() => vi.advanceTimersByTime(12000));
    expect(frontPanel()).toHaveAccessibleName("Flashcards");
  });
});
