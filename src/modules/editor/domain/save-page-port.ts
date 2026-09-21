// design.md, "notebooks como unico puerto de persistencia hacia el
// editor": editor/domain depends on the SavePagePort *type* only, imported
// through notebooks' public index.ts (cross-module-via-index), never its
// internal domain path. This file re-exports that shape so the rest of
// editor/domain and editor/application depend on `@/modules/editor`
// instead of reaching into notebooks directly from every call site.
export type {
  SavePagePort,
  TiptapDoc,
  TiptapNode,
} from "@/modules/notebooks";

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
