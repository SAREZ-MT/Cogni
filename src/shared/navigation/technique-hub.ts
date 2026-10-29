import { FROM_HUB_QUERY, fromHub } from "./hub-return";

// Phase 8 H17 (user-approved flat hubs, 2026-10-29): the technique hubs
// (/flashcards, /active-recall, /exams) list every generated item at once,
// one per page, and filter them by notebook through `?cuaderno=<id>`. The
// filter runs on the server from the page's search params.

export const NOTEBOOK_FILTER_PARAM = "cuaderno";

// A search param value as Next.js hands it to a page.
type SearchParamValue = string | string[] | undefined;

// A notebook id as it may travel in a URL: a UUID, nothing else.
const NOTEBOOK_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function selectedNotebook(value: SearchParamValue): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export interface HubFilterChip {
  // "all" for "Todos", otherwise the notebook id.
  key: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
  // The notebook's stored colour; null for "Todos".
  tone: string | null;
}

export interface HubFilterItem {
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
}

// The hub, filtered by a notebook or not.
export function hubHref(hubPath: string, notebookId: string | null): string {
  return notebookId === null
    ? hubPath
    : `${hubPath}?${NOTEBOOK_FILTER_PARAM}=${encodeURIComponent(notebookId)}`;
}

// The filter row ("Todos" plus one chip per notebook holding items, by
// title) and the items to show. A notebook id without items shows nothing
// and leaves every chip inactive, so the hub can say so.
export function notebookFilter<T extends HubFilterItem>(
  items: readonly T[],
  value: SearchParamValue,
  hubPath: string,
): { chips: HubFilterChip[]; selected: string | null; visible: T[] } {
  const selected = selectedNotebook(value);
  const byNotebook = new Map<string, HubFilterChip>();
  for (const entry of items) {
    const chip = byNotebook.get(entry.notebookId) ?? {
      key: entry.notebookId,
      label: entry.notebookTitle,
      count: 0,
      href: hubHref(hubPath, entry.notebookId),
      active: entry.notebookId === selected,
      tone: entry.notebookColor,
    };
    chip.count += 1;
    byNotebook.set(entry.notebookId, chip);
  }
  const notebooks = [...byNotebook.values()].sort(
    (a, b) =>
      a.label.localeCompare(b.label, "es") || a.key.localeCompare(b.key),
  );
  return {
    chips: [
      {
        key: "all",
        label: "Todos",
        count: items.length,
        href: hubPath,
        active: selected === null,
        tone: null,
      },
      ...notebooks,
    ],
    selected,
    visible:
      selected === null
        ? [...items]
        : items.filter((entry) => entry.notebookId === selected),
  };
}

// The hubs' order: what is due or pending first, then what was never
// practised, then the most recent; within each group the most recent
// first. Returns a new array.
export function orderHubItems<T>(
  items: readonly T[],
  keys: {
    pending: (item: T) => boolean;
    neverPractised: (item: T) => boolean;
    // A timestamp (ms); higher is more recent.
    recency: (item: T) => number;
  },
): T[] {
  const rank = (item: T) =>
    keys.pending(item) ? 0 : keys.neverPractised(item) ? 1 : 2;
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || keys.recency(b) - keys.recency(a),
  );
}

// An item's link from the hub: the H16 `?desde=hub` marker, plus the
// active notebook filter so the return keeps it.
export function hubItemHref(href: string, notebookId: string | null): string {
  const separator = href.includes("?") ? "&" : "?";
  const filter =
    notebookId !== null && NOTEBOOK_ID.test(notebookId)
      ? `&${NOTEBOOK_FILTER_PARAM}=${notebookId}`
      : "";
  return `${href}${separator}${FROM_HUB_QUERY}${filter}`;
}

// Where a practice route returns: opened from the hub, the hub (keeping a
// valid `?cuaderno=`); otherwise the hub filtered by the route's notebook,
// which replaced the notebook views. Never a URL from the query.
export function hubReturnHref(
  hubPath: string,
  params: { desde?: SearchParamValue; cuaderno?: SearchParamValue },
  notebookId: string,
): string {
  if (!fromHub(params.desde)) return hubHref(hubPath, notebookId);
  const cuaderno = selectedNotebook(params.cuaderno);
  return hubHref(
    hubPath,
    cuaderno !== null && NOTEBOOK_ID.test(cuaderno) ? cuaderno : null,
  );
}

// The hub query a practice route keeps in its own URL (`desde=hub` plus a
// valid filter), without "?"; empty when not opened from the hub.
export function hubReturnQuery(params: {
  desde?: SearchParamValue;
  cuaderno?: SearchParamValue;
}): string {
  if (!fromHub(params.desde)) return "";
  const cuaderno = selectedNotebook(params.cuaderno);
  return cuaderno !== null && NOTEBOOK_ID.test(cuaderno)
    ? `${FROM_HUB_QUERY}&${NOTEBOOK_FILTER_PARAM}=${cuaderno}`
    : FROM_HUB_QUERY;
}
