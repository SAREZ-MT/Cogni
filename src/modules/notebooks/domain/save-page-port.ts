import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { TiptapDoc } from "./plain-text";

// Re-exported so editor/domain can depend on the same document shape
// without importing notebooks internals beyond this port
// (design.md, "notebooks como unico puerto de persistencia hacia el
// editor"); the type itself is defined once, in plain-text.ts.
export type { TiptapDoc, TiptapNode } from "./plain-text";

// Structural port editor/application depends on. notebooks/index.ts
// exposes Server Actions (saveContent, getCurrentContent, in a later
// phase) that already satisfy this shape.
export interface SavePagePort {
  save(input: {
    pageId: string;
    content: TiptapDoc;
    expectedVersion: number;
  }): Promise<Result<{ version: number }, DomainError>>;
  getCurrent(
    pageId: string,
  ): Promise<Result<{ content: TiptapDoc; version: number }, DomainError>>;
}
