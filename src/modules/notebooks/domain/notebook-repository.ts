import type { Notebook } from "./notebook";

// Port implemented by infrastructure (Drizzle, phase 2) and by the
// in-memory test double (phase 1).
export interface NotebookRepository {
  // Scoped by owner (S6 tenant isolation): a row of another owner reads as
  // missing, and `update` writes nothing when the row is not the owner's.
  // The application connects to Postgres with a role that bypasses row
  // level security, so these WHERE clauses are the isolation.
  findById(id: string, ownerId: string): Promise<Notebook | null>;
  // Every new notebook of an owner MUST get a position strictly greater
  // than all its siblings, including archived ones (specs/notebooks/spec.md).
  nextPosition(ownerId: string): Promise<number>;
  create(notebook: Notebook): Promise<void>;
  update(notebook: Notebook): Promise<void>;
  listActiveByOwner(ownerId: string): Promise<Notebook[]>;
}
