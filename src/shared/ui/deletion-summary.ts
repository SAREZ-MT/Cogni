// One counted part of what a delete removes, with its Spanish singular and
// plural nouns ("página" / "páginas").
export interface DeletionPart {
  count: number;
  one: string;
  many: string;
}

// Phase 8 H19: the cascade line of a delete confirmation, e.g. "Se
// eliminarán 4 páginas, 2 mazos y 1 examen." Empty parts are skipped; the
// verb is singular only for one single item. Null when nothing is counted,
// so the dialog can show its own "empty" sentence instead.
export function deletionSummary(parts: readonly DeletionPart[]): string | null {
  const counted = parts.filter((part) => part.count > 0);
  if (counted.length === 0) return null;
  const items = counted.map(
    (part) => `${part.count} ${part.count === 1 ? part.one : part.many}`,
  );
  const list =
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
  const single = counted.length === 1 && counted[0]?.count === 1;
  return `${single ? "Se eliminará" : "Se eliminarán"} ${list}.`;
}
