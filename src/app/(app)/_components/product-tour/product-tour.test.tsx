import { fireEvent, render, screen } from "@testing-library/react";
import type { Config, DriveStep, PopoverDOM } from "driver.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductTourProvider, useProductTour } from "./product-tour";
import { TOUR_STEPS } from "./tour-steps";
import { TOUR_STORAGE_KEY } from "./tour-storage";

// Driver.js is replaced by a recorder: these tests pin the step config the
// adapter builds (which Driver.js then interprets), not the library itself.
let captured: Config | null = null;
const destroy = vi.fn();

vi.mock("driver.js/dist/driver.css", () => ({}));
vi.mock("driver.js", () => ({
  driver: (config: Config) => {
    captured = config;
    return {
      drive: vi.fn(),
      isActive: () => false,
      destroy: () => {
        destroy();
        config.onDestroyed?.(undefined, {} as DriveStep, {} as never);
      },
    };
  },
}));
// jsdom has no layout, so every anchor counts as on screen.
vi.mock("./tour-steps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tour-steps")>();
  return { ...actual, tourStepsFor: () => [...actual.TOUR_STEPS] };
});

function Launcher() {
  const { start } = useProductTour();
  return (
    <button type="button" onClick={start}>
      start
    </button>
  );
}

function launch(): DriveStep[] {
  render(
    <ProductTourProvider>
      <Launcher />
    </ProductTourProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "start" }));
  if (!captured?.steps) throw new Error("driver() was not configured");
  return captured.steps;
}

function fakePopover(): PopoverDOM {
  const wrapper = document.createElement("div");
  const title = document.createElement("header");
  const footerButtons = document.createElement("span");
  const previousButton = document.createElement("button");
  const nextButton = document.createElement("button");
  footerButtons.append(previousButton, nextButton);
  wrapper.append(title, footerButtons);
  document.body.append(wrapper);
  return {
    wrapper,
    title,
    footerButtons,
    previousButton,
    nextButton,
    arrow: document.createElement("div"),
    description: document.createElement("div"),
    footer: document.createElement("footer"),
    closeButton: document.createElement("button"),
    progress: document.createElement("span"),
  };
}

function renderPopover(step: DriveStep): PopoverDOM {
  const popover = fakePopover();
  step.popover?.onPopoverRender?.(popover, {} as never);
  return popover;
}

const CREATE_INDEX = TOUR_STEPS.findIndex((s) => s.id === "crear-cuaderno");

describe("ProductTourProvider step config", () => {
  beforeEach(() => {
    captured = null;
    destroy.mockClear();
    window.localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("blocks interaction with the highlighted element on steps 2–4", () => {
    const steps = launch();
    expect(
      steps.slice(1, CREATE_INDEX).map((s) => s.disableActiveInteraction),
    ).toEqual([true, true, true]);
  });

  it("keeps the create button clickable on step 5", () => {
    const steps = launch();
    expect(steps[CREATE_INDEX].disableActiveInteraction).toBe(false);
  });

  // Step 5 carries three footer buttons (Terminar, Atrás, Crear cuaderno),
  // so its popover is wider and "Crear cuaderno" never gets cut off.
  it("gives the step 5 popover the wider create class", () => {
    const steps = launch();
    expect(steps[CREATE_INDEX].popover?.popoverClass).toBe(
      "cogni-tour cogni-tour-create",
    );
  });

  it("lets previous (button and ArrowLeft) go back from step 5", () => {
    const step = launch()[CREATE_INDEX];
    // No onPrevClick override: Driver.js then moves to the previous step for
    // both the button and the ArrowLeft key, under the global "Atrás" label.
    expect(step.popover?.onPrevClick).toBeUndefined();
    expect(step.popover?.prevBtnText).toBeUndefined();
    expect(captured?.prevBtnText).toBe("Atrás");
  });

  it("adds a Terminar button on step 5 that ends the tour as done", () => {
    const step = launch()[CREATE_INDEX];
    const popover = renderPopover(step);
    const finishButton = Array.from(
      popover.footerButtons.querySelectorAll("button"),
    ).find((b) => b.textContent === "Terminar");
    expect(finishButton).toBeDefined();
    finishButton?.click();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe("done");
  });

  it("does not mark the step 5 popover as modal", () => {
    const popover = renderPopover(launch()[CREATE_INDEX]);
    expect(popover.wrapper.hasAttribute("aria-modal")).toBe(false);
  });

  it("marks the other popovers as modal", () => {
    const steps = launch();
    for (const index of [0, 1, 2, 3]) {
      const popover = renderPopover(steps[index]);
      expect(popover.wrapper.getAttribute("aria-modal")).toBe("true");
    }
  });
});
