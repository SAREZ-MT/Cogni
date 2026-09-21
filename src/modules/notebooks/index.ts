// Public surface of the notebooks module (cross-module-via-index in
// .dependency-cruiser.cjs forbids importing anything else from it).
// Phase 1 has no infrastructure or Server Actions yet (design.md, "notebooks
// como unico puerto de persistencia hacia el editor" lands in a later
// phase): this barrel exposes domain types/ports and the application use
// cases so tests and future Server Actions can compose them.

export {
  archiveNotebook,
  archiveNotebookSchema,
  archivePage,
  archivePageSchema,
  createNotebook,
  createNotebookSchema,
  createPage,
  createPageSchema,
  getPage,
  getPageSchema,
  listSidebar,
  renameNotebook,
  renameNotebookSchema,
  renamePage,
  renamePageSchema,
  type SidebarNotebook,
  type SidebarPage,
  savePage,
  savePageSchema,
  setNotebookAppearance,
  setNotebookAppearanceSchema,
} from "./application";
export {
  ASSET_ERROR,
  COLOR_PALETTE,
  DEFAULT_PAGE_TITLE,
  EMPTY_DOC,
  extractPlainText,
  type NewNotebook,
  type NewPage,
  NOTEBOOK_ERROR,
  type Notebook,
  type NotebookColor,
  type NotebookRepository,
  PAGE_ERROR,
  type Page,
  type PageAsset,
  type PageAssetRepository,
  type PageRepository,
  type SavePagePort,
  type StorageGateway,
  TITLE_MAX_LENGTH,
  type TiptapDoc,
  type TiptapNode,
  type UpdateIfVersionInput,
  type UpdateIfVersionResult,
} from "./domain";
