// Phase 8 H19: where to go after a hard delete when the current route
// shows what was deleted. A deleted page sends its routes (the editor, a
// technique's player or edit page) to its notebook; a deleted notebook
// sends every route under it to Cuadernos. Null: the route survives, stay
// and refresh. Matching whole path segments keeps it to real ids.
export function routeAfterDelete(
  pathname: string,
  target: { notebookId: string; pageId?: string },
): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (target.pageId !== undefined) {
    return segments.includes(target.pageId)
      ? `/notebooks/${target.notebookId}`
      : null;
  }
  return segments.includes(target.notebookId) ? "/notebooks" : null;
}
