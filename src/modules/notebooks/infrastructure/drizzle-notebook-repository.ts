import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { type NotebookRow, notebooks } from "@/shared/db/schema";
import type { Notebook, NotebookColor } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";

function toNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    icon: row.icon,
    color: row.color as NotebookColor | null,
    position: row.position,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleNotebookRepository implements NotebookRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Notebook | null> {
    const row = await this.db.query.notebooks.findFirst({
      where: eq(notebooks.id, id),
    });
    return row ? toNotebook(row) : null;
  }

  // Includes archived siblings so a re-created notebook never reuses a
  // position (specs/notebooks/spec.md, "Posiciones estrictamente crecientes").
  async nextPosition(ownerId: string): Promise<number> {
    const last = await this.db.query.notebooks.findFirst({
      where: eq(notebooks.ownerId, ownerId),
      orderBy: [desc(notebooks.position)],
    });
    return (last?.position ?? 0) + 1;
  }

  async create(notebook: Notebook): Promise<void> {
    await this.db.insert(notebooks).values({
      id: notebook.id,
      ownerId: notebook.ownerId,
      title: notebook.title,
      icon: notebook.icon,
      color: notebook.color,
      position: notebook.position,
      archivedAt: notebook.archivedAt,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    });
  }

  async update(notebook: Notebook): Promise<void> {
    await this.db
      .update(notebooks)
      .set({
        title: notebook.title,
        icon: notebook.icon,
        color: notebook.color,
        position: notebook.position,
        archivedAt: notebook.archivedAt,
        updatedAt: notebook.updatedAt,
      })
      .where(eq(notebooks.id, notebook.id));
  }

  async listActiveByOwner(ownerId: string): Promise<Notebook[]> {
    const rows = await this.db.query.notebooks.findMany({
      where: and(eq(notebooks.ownerId, ownerId), isNull(notebooks.archivedAt)),
      orderBy: [notebooks.position],
    });
    return rows.map(toNotebook);
  }
}
