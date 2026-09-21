import type { Notebook } from "./notebook";

// Port implemented by infrastructure (Drizzle, phase 2) and by the
// in-memory test double (phase 1).
export interface NotebookRepository {
  findById(id: string): Promise<Notebook | null>;
  // Every new notebook of an owner MUST get a position strictly greater
  // than all its siblings, including archived ones (specs/notebooks/spec.md).
  nextPosition(ownerId: string): Promise<number>;
  create(notebook: Notebook): Promise<void>;
  update(notebook: Notebook): Promise<void>;
  listActiveByOwner(ownerId: string): Promise<Notebook[]>;
}
