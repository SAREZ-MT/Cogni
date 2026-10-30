// Phase 8 H16: a practice route opened from its technique hub's "create
// from a page" dialog carries `?desde=hub`, so its back links and its
// finish return to that hub instead of the notebook view. The query is a
// marker, never a URL: the route picks its own hub, so nothing outside
// the app can be reached through it (no open redirect).

export const FROM_HUB_PARAM = "desde";
export const FROM_HUB_QUERY = `${FROM_HUB_PARAM}=hub`;

// A search param value as Next.js hands it to a page.
type SearchParamValue = string | string[] | undefined;

export function fromHub(value: SearchParamValue): boolean {
  return value === "hub";
}

// The hub when the route was opened from it, otherwise the fallback
// (the route's usual back target).
export function returnHref(
  value: SearchParamValue,
  hubHref: string,
  fallbackHref: string,
): string {
  return fromHub(value) ? hubHref : fallbackHref;
}
