import type { ActionError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { TiptapDoc } from "@/shared/kernel/tiptap-doc";

// design.md, "notebooks como unico puerto de persistencia hacia el
// editor": editor owns the persistence port it depends on. editor/domain
// may only import its own domain or shared/kernel (`domain-is-pure`, which
// dependency-cruiser also enforces for type-only imports through
// `tsPreCompilationDeps`), so the port is declared here and the document
// shape comes from shared/kernel/tiptap-doc.ts. notebooks never imports this
// type: its saveContent/getCurrentContent Server Actions satisfy it
// structurally, and the page route (the composition root) is where tsc
// checks that they do. TiptapDoc/TiptapNode are re-exported so the rest of
// editor keeps one import path for the document shape.
export type { TiptapDoc, TiptapNode } from "@/shared/kernel/tiptap-doc";

// The error type is ActionError (a plain { code, message }, from
// shared/kernel/domain-error.ts's toActionError()), not DomainError: a
// Server Action's return value crosses the RSC/Flight boundary, which
// redacts Error subclasses, so a DomainError instance never survives as one
// on the client. Every real caller of this port is a Server Action, so the
// port's contract reflects what a caller on the other side of that boundary
// actually receives.
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

// The DomainError code notebooks/application/save-page.ts returns for a
// stale content_version (notebooks/domain/errors.ts, PAGE_ERROR.VERSION_
// CONFLICT). Redeclared as a literal here instead of importing the value
// from `@/modules/notebooks`: that barrel also re-exports the module's
// Server Actions (actions.ts), which eagerly import `@/modules/identity`
// (itself guarded by `import "server-only"`) — a value import would pull
// that whole server-only graph into editor/application and its tests just
// to read one string constant. A type-only import (above) has no such
// runtime cost because TypeScript erases it entirely.
export const PAGE_VERSION_CONFLICT_CODE = "PAGE_VERSION_CONFLICT";
