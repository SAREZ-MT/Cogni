"use client";

import { type Driver, type DriveStep, driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { type TourStep, tourStepsFor } from "./tour-steps";
import {
  browserTourStorage,
  persistTourOutcome,
  shouldAutoLaunchTour,
  type TourOutcome,
} from "./tour-storage";

// Guided product tour (docs/new_design_fase_8/inicio-tour-y-empty-state.md
// §1): a thin adapter over Driver.js. The provider renders nothing visible;
// it creates a driver on demand and destroys it on unmount. Steps and copy
// live in tour-steps.ts, the per-browser memory in tour-storage.ts, and the
// `cogni-tour` theme in src/app/product-tour.css.

type ProductTourValue = { start: () => void };

// Outside the provider (unit tests, isolated renders) start() is a no-op.
const ProductTourContext = createContext<ProductTourValue>({
  start: () => {},
});

export function useProductTour(): ProductTourValue {
  return useContext(ProductTourContext);
}

function isOnScreen(selector: string): boolean {
  const element = document.querySelector(selector);
  return element instanceof HTMLElement && element.getClientRects().length > 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function createTour(onEnd: () => void): Driver {
  const storage = browserTourStorage();
  // Esc, unmount and "Omitir" all count as dismissed unless a step said done.
  let outcome: TourOutcome = "dismissed";
  // Element to hand focus back to (§1.7). Driver.js would refocus whatever
  // was focused when the last step rendered, usually a removed popover button.
  let returnFocusTo: Element | null = document.activeElement;
  let releaseAnchorClick: (() => void) | null = null;

  const finish = (result: TourOutcome) => {
    outcome = result;
    tour.destroy();
  };

  // A text button before "Atrás"/"Siguiente". Driver.js only intercepts
  // clicks on its own prev/next/close buttons, so this one keeps its listener.
  const addFooterButton = (
    footerButtons: HTMLElement,
    label: string,
    onClick: () => void,
  ) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cogni-tour-skip";
    button.textContent = label;
    button.addEventListener("click", onClick);
    footerButtons.prepend(button);
  };

  const decorate = (
    popover: { wrapper: HTMLElement; footerButtons: HTMLElement },
    withSkip: boolean,
  ) => {
    popover.wrapper.setAttribute("aria-modal", "true");
    if (withSkip) {
      addFooterButton(popover.footerButtons, "Omitir", () =>
        finish("dismissed"),
      );
    }
  };

  // Step 5: "Crear cuaderno" and a direct click on the highlighted button
  // both end the tour and open the existing CreateNotebookTrigger dialog.
  const openCreateNotebook = (anchor: string) => {
    returnFocusTo = null;
    finish("done");
    document.querySelector<HTMLElement>(anchor)?.click();
  };

  const toDriveStep = (step: TourStep): DriveStep => {
    const base = { title: step.title, description: step.description };
    if (!step.anchor) {
      return {
        popover: {
          ...base,
          popoverClass: "cogni-tour cogni-tour-welcome",
          nextBtnText: "Empezar",
          prevBtnText: "Ahora no",
          // Driver.js disables "previous" on the first step; here it is
          // the "Ahora no" exit.
          disableButtons: [],
          onPrevClick: () => finish("dismissed"),
          onPopoverRender: (popover) => {
            decorate(popover, false);
            // Decorative illustration above the title (user 2026-10-18).
            const art = document.createElement("img");
            art.src = "/illustrations/tour-welcome.webp";
            art.alt = "";
            art.width = 880;
            art.height = 609;
            art.className = "cogni-tour-art";
            popover.title.before(art);
          },
        },
      };
    }
    if (step.id === "crear-cuaderno") {
      const anchor = step.anchor;
      return {
        element: anchor,
        disableActiveInteraction: false,
        onHighlighted: (element) => {
          if (!element) return;
          const onClick = () => {
            returnFocusTo = null;
            finish("done");
          };
          element.addEventListener("click", onClick, { capture: true });
          releaseAnchorClick = () =>
            element.removeEventListener("click", onClick, { capture: true });
        },
        onDeselected: () => {
          releaseAnchorClick?.();
          releaseAnchorClick = null;
        },
        popover: {
          ...base,
          // Three footer buttons (Terminar, Atrás, Crear cuaderno): wider.
          popoverClass: "cogni-tour cogni-tour-create",
          side: "bottom",
          align: "center",
          // No onPrevClick: "Atrás" and ArrowLeft (Driver.js routes the key to
          // the same handler) go back to step 4. "Terminar" is an extra
          // footer button that ends the tour as done.
          onDoneClick: () => openCreateNotebook(anchor),
          onPopoverRender: (popover) => {
            // Not aria-modal: the highlighted "Crear cuaderno" button lives
            // outside the popover and must stay reachable.
            addFooterButton(popover.footerButtons, "Terminar", () =>
              finish("done"),
            );
          },
        },
      };
    }
    return {
      element: step.anchor,
      // Explanatory steps: a click on the highlighted sidebar link must not
      // navigate away mid-tour.
      disableActiveInteraction: true,
      popover: {
        ...base,
        side: "right",
        align: "start",
        // Only used when this step ends the tour (no create step on screen).
        doneBtnText: "Terminar",
        onPopoverRender: (popover) => decorate(popover, true),
      },
    };
  };

  const steps = tourStepsFor(isOnScreen).map(toDriveStep);

  const tour = driver({
    steps,
    showProgress: true,
    progressText: "Paso {{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Crear cuaderno",
    // No close (×): "Omitir" and Esc cover it.
    showButtons: ["next", "previous"],
    overlayOpacity: 0.5,
    stagePadding: 8,
    stageRadius: 12,
    overlayClickBehavior: "none",
    allowKeyboardControl: true,
    allowClose: true,
    skipMissingElement: true,
    smoothScroll: true,
    animate: !prefersReducedMotion(),
    popoverClass: "cogni-tour",
    onDoneClick: () => finish("done"),
    onDestroyed: () => {
      releaseAnchorClick?.();
      persistTourOutcome(storage, outcome);
      if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) {
        returnFocusTo.focus();
      }
      onEnd();
    },
  });
  return tour;
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const tourRef = useRef<Driver | null>(null);

  const start = useCallback(() => {
    if (tourRef.current?.isActive()) return;
    const tour = createTour(() => {
      if (tourRef.current === tour) tourRef.current = null;
    });
    tourRef.current = tour;
    tour.drive();
  }, []);

  useEffect(() => () => tourRef.current?.destroy(), []);

  const value = useMemo(() => ({ start }), [start]);
  return (
    <ProductTourContext.Provider value={value}>
      {children}
    </ProductTourContext.Provider>
  );
}

// Rendered by Home only when the owner has no notebooks (the server-side
// fact that also picks the empty state): launches the tour once per browser.
export function TourAutoStart() {
  const { start } = useProductTour();

  // Deferred one task and cancelled on cleanup: under Strict Mode's
  // mount/unmount/mount the first pass is dropped instead of starting a
  // tour that the provider's own cleanup would destroy right away.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shouldAutoLaunchTour(true, browserTourStorage())) start();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [start]);

  return null;
}
