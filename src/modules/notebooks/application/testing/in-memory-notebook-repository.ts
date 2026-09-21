import type { Notebook } from "../../domain/notebook";
import type { NotebookRepository } from "../../domain/notebook-repository";

// Test double for the NotebookRepository port. position assignment mirrors
// the SQL adapter: strictly greater than every sibling's position, active
// or archived.
export class InMemoryNotebookRepository implements NotebookRepository {
  private readonly rows = new Map<string, Notebook>();

  async findById(id: string): Promise<Notebook | null> {
    return this.rows.get(id) ?? null;
  }

  async nextPosition(ownerId: string): Promise<number> {
    let max = 0;
    for (const notebook of this.rows.values()) {
      if (notebook.ownerId === ownerId && notebook.position > max) {
        max = notebook.position;
      }
    }
    return max + 1;
  }

  async create(notebook: Notebook): Promise<void> {
    this.rows.set(notebook.id, notebook);
  }

  async update(notebook: Notebook): Promise<void> {
    this.rows.set(notebook.id, notebook);
  }

  async listActiveByOwner(ownerId: string): Promise<Notebook[]> {
    return [...this.rows.values()]
      .filter(
        (notebook) => notebook.ownerId === ownerId && !notebook.archivedAt,
      )
      .sort((a, b) => a.position - b.position);
  }

  count(): number {
    return this.rows.size;
  }
}
