import type { ActionError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { TiptapDoc } from "./plain-text";

// Re-exported so editor/domain can depend on the same document shape
// without importing notebooks internals beyond this port
// (design.md, "notebooks como unico puerto de persistencia hacia el
// editor"); the type itself is defined once, in plain-text.ts.
export type { TiptapDoc, TiptapNode } from "./plain-text";

// Structural port editor/application depends on. notebooks/index.ts
// exposes Server Actions (saveContent, getCurrentContent) that already
// satisfy this shape. The error type is ActionError (a plain
// { code, message }, from shared/kernel/domain-error.ts's toActionError()),
// not DomainError: a Server Action's return value crosses the RSC/Flight
// boundary, which redacts Error subclasses, so a DomainError instance
// never survives as one on the client. Every real caller of this port is a
// Server Action, so the port's contract reflects what a caller on the
// other side of that boundary actually receives.
export interface SavePagePort {
  save(input: {
    pageId: string;
    content: TiptapDoc;
    expectedVersion: number;
  }): Promise<Result<{ version: number }, ActionError>>;
  getCurrent(
    pageId: string,
  ): Promise<Result<{ content: TiptapDoc; version: number }, ActionError>>;
}
