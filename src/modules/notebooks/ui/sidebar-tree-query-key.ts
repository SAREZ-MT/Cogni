// The TanStack Query key for the sidebar tree, factored out of
// sidebar-tree-client.tsx into its own module so notebook-item.tsx can
// import the exact same key (TanStack Query matches by value, not by
// reference) without a circular import between the two UI files, and
// without a second, driftable copy of the literal (T10 review follow-up
// from T9: R3-duplicated-query-key-drift). Not exported from
// notebooks/index.ts: the key stays private to `notebooks` (design.md,
// "clave que sigue siendo privada de notebooks").
export const SIDEBAR_TREE_QUERY_KEY = ["notebooks", "sidebar-tree"] as const;
