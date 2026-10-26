import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { ImportedDoc } from "../../domain/imported-doc";
import type { NotebookPagesPort } from "../../domain/notebook-pages-port";

interface FakeNotebook {
  id: string;
  ownerId: string;
  active: boolean;
}

interface FakePage {
  id: string;
  ownerId: string;
  notebookId: string;
  title?: string;
  content: ImportedDoc | null;
  version: number;
}

// The literal codes notebooks/domain/errors.ts's PAGE_ERROR exports.
// Hardcoded (not imported) because `cross-module-via-index` forbids
// `ingestion` from reaching into `notebooks` for anything but its public
// index, and this fake must stay a pure double regardless.
const PAGE_NOT_FOUND = "PAGE_NOT_FOUND";
const PAGE_VERSION_CONFLICT = "PAGE_VERSION_CONFLICT";
// Same for notebooks' ASSET_ERROR and its page-asset rules
// (domain/page-asset.ts): this fake refuses what storeImportedAsset would.
const ASSET_MIME_NOT_ALLOWED = "ASSET_MIME_NOT_ALLOWED";
const ASSET_TOO_LARGE = "ASSET_TOO_LARGE";
const ASSET_UPLOAD_FAILED = "ASSET_UPLOAD_FAILED";
const ALLOWED_ASSET_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

// Test double for NotebookPagesPort — a minimal in-memory notebooks+pages
// world, just enough for `requestPdfUpload`/`startPdfImport` (T5) and
// `processImportJob` (T6) to exercise every branch without depending on
// the real `notebooks` module.
export class FakeNotebookPagesPort implements NotebookPagesPort {
  private readonly notebooks = new Map<string, FakeNotebook>();
  private readonly pages = new Map<string, FakePage>();
  private forcedCreatePageError: DomainError | null = null;

  readonly createPageCalls: Array<{
    ownerId: string;
    notebookId: string;
    title?: string;
  }> = [];
  readonly writeImportedContentCalls: Array<{
    ownerId: string;
    pageId: string;
  }> = [];
  // document-import T9.
  readonly storeImportedAssetCalls: Array<{
    ownerId: string;
    pageId: string;
    mime: string;
    size: number;
  }> = [];
  readonly deleteImportedAssetsCalls: Array<{
    ownerId: string;
    assetIds: string[];
  }> = [];
  private readonly assets = new Map<string, { ownerId: string }>();
  private readonly storeFailures = new Map<number, "error" | "throw">();

  // Makes the store call with this zero-based index fail, either with an
  // err(ASSET_UPLOAD_FAILED) Result or by throwing.
  failStoreAt(callIndex: number, mode: "error" | "throw"): void {
    this.storeFailures.set(callIndex, mode);
  }

  // Ids of the assets currently stored, in creation order.
  storedAssetIds(): string[] {
    return [...this.assets.keys()];
  }

  addNotebook(notebook: FakeNotebook): void {
    this.notebooks.set(notebook.id, notebook);
  }

  getPage(pageId: string): FakePage | undefined {
    return this.pages.get(pageId);
  }

  // Forces the next createPage() call to fail — simulates the notebook
  // being archived/deleted between the active-notebook check and page
  // creation, so callers can exercise that error-propagation branch.
  forceNextCreatePageError(error: DomainError): void {
    this.forcedCreatePageError = error;
  }

  async findActiveNotebook(
    ownerId: string,
    notebookId: string,
  ): Promise<{ id: string } | null> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook || notebook.ownerId !== ownerId || !notebook.active) {
      return null;
    }
    return { id: notebook.id };
  }

  async createPage(
    ownerId: string,
    input: { notebookId: string; title?: string },
  ): Promise<Result<{ id: string; notebookId: string }, DomainError>> {
    this.createPageCalls.push({ ownerId, ...input });
    if (this.forcedCreatePageError) {
      const error = this.forcedCreatePageError;
      this.forcedCreatePageError = null;
      return err(error);
    }
    const page: FakePage = {
      id: createId(),
      ownerId,
      notebookId: input.notebookId,
      title: input.title,
      content: null,
      version: 1,
    };
    this.pages.set(page.id, page);
    return ok({ id: page.id, notebookId: page.notebookId });
  }

  async findPageNotebookId(
    ownerId: string,
    pageId: string,
  ): Promise<string | null> {
    const page = this.pages.get(pageId);
    if (!page || page.ownerId !== ownerId) return null;
    return page.notebookId;
  }

  async writeImportedContent(
    ownerId: string,
    input: { pageId: string; content: ImportedDoc; expectedVersion: number },
  ): Promise<Result<{ version: number }, DomainError>> {
    this.writeImportedContentCalls.push({ ownerId, pageId: input.pageId });
    const page = this.pages.get(input.pageId);
    if (!page || page.ownerId !== ownerId) {
      return err(new DomainError(PAGE_NOT_FOUND, input.pageId));
    }
    if (page.version !== input.expectedVersion) {
      return err(new DomainError(PAGE_VERSION_CONFLICT, input.pageId));
    }
    page.content = input.content;
    page.version += 1;
    return ok({ version: page.version });
  }

  async storeImportedAsset(
    ownerId: string,
    input: { pageId: string; bytes: Uint8Array; mime: string },
  ): Promise<Result<{ assetId: string }, DomainError>> {
    const callIndex = this.storeImportedAssetCalls.length;
    this.storeImportedAssetCalls.push({
      ownerId,
      pageId: input.pageId,
      mime: input.mime,
      size: input.bytes.length,
    });
    const failure = this.storeFailures.get(callIndex);
    if (failure === "throw") throw new Error("storeImportedAsset threw");
    if (failure === "error") {
      return err(new DomainError(ASSET_UPLOAD_FAILED, input.pageId));
    }
    if (!ALLOWED_ASSET_MIMES.has(input.mime)) {
      return err(new DomainError(ASSET_MIME_NOT_ALLOWED, input.mime));
    }
    if (input.bytes.length > MAX_ASSET_BYTES) {
      return err(new DomainError(ASSET_TOO_LARGE, String(input.bytes.length)));
    }
    const page = this.pages.get(input.pageId);
    if (!page || page.ownerId !== ownerId) {
      return err(new DomainError(PAGE_NOT_FOUND, input.pageId));
    }
    const assetId = createId();
    this.assets.set(assetId, { ownerId });
    return ok({ assetId });
  }

  async deleteImportedAssets(
    ownerId: string,
    assetIds: readonly string[],
  ): Promise<void> {
    this.deleteImportedAssetsCalls.push({ ownerId, assetIds: [...assetIds] });
    for (const id of assetIds) {
      if (this.assets.get(id)?.ownerId === ownerId) this.assets.delete(id);
    }
  }
}
