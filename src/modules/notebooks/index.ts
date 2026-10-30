// Public surface of the notebooks module (cross-module-via-index in
// .dependency-cruiser.cjs forbids importing anything else from it).
// Phase 2 adds the Server Actions (actions.ts): every client-reachable
// mutation of this module goes through them (design.md, "notebooks como
// unico puerto de persistencia hacia el editor").

export {
  createNotebook as createNotebookAction,
  createPage as createPageAction,
  deleteNotebook as deleteNotebookAction,
  deletePage as deletePageAction,
  getAssetReadUrl,
  getCurrentContent,
  getHomeOverview,
  getNotebookForRoute,
  getNotebookTitleForRoute,
  getPageForRoute,
  getPagePickerTree,
  getSidebarTree,
  listPagesForMention,
  type MentionPageCandidate,
  previewNotebookDeletion as previewNotebookDeletionAction,
  previewPageDeletion as previewPageDeletionAction,
  registerPageAsset,
  renameNotebook as renameNotebookAction,
  renamePage as renamePageAction,
  requestImageUpload,
  saveContent,
  setNotebookAppearance as setNotebookAppearanceAction,
} from "./actions";
export {
  createNotebook,
  createNotebookSchema,
  createPage,
  createPageSchema,
  DEFAULT_WEEKLY_GOAL_DAYS,
  getAssetReadUrlSchema,
  getPage,
  getPageSchema,
  type HomeActivityWindow,
  type HomeNotebookSummary,
  type HomeOverview,
  type HomeReadyToReview,
  type HomeRecentPage,
  type ImageUploadGrant,
  listPagePickerTree,
  listSidebar,
  type PagePickerNotebookEntry,
  type PagePickerPage,
  registerPageAssetSchema,
  renameNotebook,
  renameNotebookSchema,
  renamePage,
  renamePageSchema,
  requestImageUploadSchema,
  type SidebarNotebook,
  type SidebarPage,
  type StoreImportedAssetInput,
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
  type PageText,
  type PageTextReader,
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
export { CreateNotebookTrigger } from "./ui/create-notebook-trigger";
export {
  DeleteNotebookDialog,
  DeletePageButton,
  DeletePageDialog,
} from "./ui/delete-content-dialogs";
export {
  type NotebookActionsHelpers,
  NotebookActionsSlotProvider,
  type NotebookActionsSlotTarget,
  type NotebookActionsSlotValue,
  type PageActionsSlotTarget,
} from "./ui/notebook-actions-slot";
export { NotebookCardActions } from "./ui/notebook-card-actions";
export {
  PageTitleEditor,
  type PageTitleEditorProps,
} from "./ui/page-title-editor";
export { SidebarTree } from "./ui/sidebar-tree";
