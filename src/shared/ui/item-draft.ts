// The local draft of an edit page (Phase 8 H18, user 2026-10-29): every
// change stays here until "Guardar", which sends the operations at once.
// Pure, so the reduction from draft to operations is tested on its own.

export interface DraftEntry<T> {
  // Stable React key: the stored id, or a local one for a new entry.
  readonly key: string;
  // The stored id; null for an entry added in this draft.
  readonly id: string | null;
  readonly value: T;
  // The stored value; null for a new entry.
  readonly original: T | null;
  // Marked for deletion (kept so "Deshacer" can bring it back).
  readonly deleted: boolean;
}

export interface DraftOperations<T> {
  updates: ({ id: string } & T)[];
  creates: T[];
  deletes: string[];
}

let nextLocalKey = 0;

function sameValue<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function draftFrom<T>(
  items: readonly { id: string; value: T }[],
): DraftEntry<T>[] {
  return items.map((item) => ({
    key: item.id,
    id: item.id,
    value: item.value,
    original: item.value,
    deleted: false,
  }));
}

export function updateDraftEntry<T>(
  draft: readonly DraftEntry<T>[],
  key: string,
  value: T,
): DraftEntry<T>[] {
  return draft.map((entry) =>
    entry.key === key ? { ...entry, value } : entry,
  );
}

export function addDraftEntry<T>(
  draft: readonly DraftEntry<T>[],
  value: T,
): DraftEntry<T>[] {
  nextLocalKey += 1;
  return [
    ...draft,
    {
      key: `new-${nextLocalKey}`,
      id: null,
      value,
      original: null,
      deleted: false,
    },
  ];
}

// A stored entry is marked; a new one simply goes away.
export function removeDraftEntry<T>(
  draft: readonly DraftEntry<T>[],
  key: string,
): DraftEntry<T>[] {
  return draft.flatMap((entry) => {
    if (entry.key !== key) return [entry];
    return entry.id === null ? [] : [{ ...entry, deleted: true }];
  });
}

export function restoreDraftEntry<T>(
  draft: readonly DraftEntry<T>[],
  key: string,
): DraftEntry<T>[] {
  return draft.map((entry) =>
    entry.key === key ? { ...entry, deleted: false } : entry,
  );
}

export function isEdited<T>(entry: DraftEntry<T>): boolean {
  return (
    entry.id !== null &&
    !entry.deleted &&
    entry.original !== null &&
    !sameValue(entry.value, entry.original)
  );
}

// What "Guardar" sends: the edited stored entries, the new ones and the
// stored ids marked for deletion (a deleted entry's edits are dropped).
export function draftOperations<T>(
  draft: readonly DraftEntry<T>[],
): DraftOperations<T> {
  const operations: DraftOperations<T> = {
    updates: [],
    creates: [],
    deletes: [],
  };
  for (const entry of draft) {
    if (entry.id === null) operations.creates.push(entry.value);
    else if (entry.deleted) operations.deletes.push(entry.id);
    else if (isEdited(entry))
      operations.updates.push({ id: entry.id, ...entry.value });
  }
  return operations;
}

export function draftChangeCount<T>(draft: readonly DraftEntry<T>[]): number {
  const { updates, creates, deletes } = draftOperations(draft);
  return updates.length + creates.length + deletes.length;
}

// Entries left once the draft is saved.
export function remainingCount<T>(draft: readonly DraftEntry<T>[]): number {
  return draft.filter((entry) => !entry.deleted).length;
}
