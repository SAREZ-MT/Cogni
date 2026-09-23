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
  getAssetReadUrl,
  getCurrentContent,
  getNotebookForRoute,
  getNotebookTitleForRoute,
  getPageForRoute,
  getSidebarTree,
  registerPageAsset,
  renameNotebook as renameNotebookAction,
  renamePage as renamePageAction,
  requestImageUpload,
  saveContent,
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
  getAssetReadUrlSchema,
  getPage,
  getPageSchema,
  type ImageUploadGrant,
  listSidebar,
  registerPageAssetSchema,
  renameNotebook,
  renameNotebookSchema,
  renamePage,
  renamePageSchema,
  requestImageUploadSchema,
  type SidebarNotebook,
  type SidebarPage,
  savePage,
  savePageSchema,
  setNotebookAppearance,
  setNotebookAppearanceSchema,
  writeImportedContent,
  writeImportedContentSchema,
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
export {
  createNotebooksServerApi,
  type NotebooksServerApi,
} from "./server-api";
export { CreateNotebookIconButton } from "./ui/create-notebook-icon-button";
export {
  type NotebookActionsHelpers,
  NotebookActionsSlotProvider,
  type NotebookActionsSlotTarget,
  type NotebookActionsSlotValue,
  type PageActionsSlotTarget,
} from "./ui/notebook-actions-slot";
export { SidebarTree } from "./ui/sidebar-tree";
