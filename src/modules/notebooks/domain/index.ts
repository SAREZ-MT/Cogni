export { ASSET_ERROR, NOTEBOOK_ERROR, PAGE_ERROR } from "./errors";
export {
  COLOR_PALETTE,
  createNotebook,
  type NewNotebook,
  type Notebook,
  type NotebookColor,
  TITLE_MAX_LENGTH,
  validateColor,
  validateTitle,
} from "./notebook";
export type { NotebookRepository } from "./notebook-repository";
export {
  createPage,
  DEFAULT_PAGE_TITLE,
  EMPTY_DOC,
  type NewPage,
  type Page,
} from "./page";
export type { PageAsset, PageAssetRepository } from "./page-asset-repository";
export type {
  PageRepository,
  UpdateIfVersionInput,
  UpdateIfVersionResult,
} from "./page-repository";
export {
  extractPlainText,
  type TiptapDoc,
  type TiptapNode,
} from "./plain-text";
export type { SavePagePort } from "./save-page-port";
export type { StorageGateway } from "./storage-gateway";
