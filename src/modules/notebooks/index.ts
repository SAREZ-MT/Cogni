// Public surface of the notebooks module (cross-module-via-index in
// .dependency-cruiser.cjs forbids importing anything else from it).
// Phase 2 adds the Server Actions (actions.ts): every client-reachable
// mutation of this module goes through them (design.md, "notebooks como
// unico puerto de persistencia hacia el editor").

export {
  archiveNotebook as archiveNotebookAction,
  archivePage as archivePageAction,
  createNotebook as createNotebookAction,
  createPage as createPageAction,
  getCurrentContent,
  getNotebookForRoute,
  getPageForRoute,
  getSidebarTree,
  renameNotebook as renameNotebookAction,
  renamePage as renamePageAction,
  setNotebookAppearance as setNotebookAppearanceAction,
} from "./actions";
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
export { SidebarTree } from "./ui/sidebar-tree";
