// Per-browser memory of the product tour (spec §1.3). Bumping the key's
// version (v2) shows the tour again after a UI change. Every access is
// wrapped: private modes can throw on read or write, and then the tour must
// not launch by itself.

export const TOUR_STORAGE_KEY = "cogni.tour.v1";

export type TourOutcome = "done" | "dismissed";

type TourStorage = Pick<Storage, "getItem" | "setItem">;

// `localStorage` itself can throw on access (blocked site data).
export function browserTourStorage(): TourStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function shouldAutoLaunchTour(
  hasNoNotebooks: boolean,
  storage: TourStorage | null,
): boolean {
  if (!hasNoNotebooks || !storage) return false;
  try {
    return storage.getItem(TOUR_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

export function persistTourOutcome(
  storage: TourStorage | null,
  outcome: TourOutcome,
): void {
  try {
    storage?.setItem(TOUR_STORAGE_KEY, outcome);
  } catch {
    // Best effort: a failed write only means the tour may show again.
  }
}
