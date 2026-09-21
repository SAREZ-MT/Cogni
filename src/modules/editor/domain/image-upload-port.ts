import type { ActionError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";

export interface ImageUploadGrant {
  storagePath: string;
  signedUrl: string;
  token: string;
  bucket: string;
}

export interface PageAssetSummary {
  id: string;
  mime: string;
  sizeBytes: number;
}

// Structural port over notebooks' image pipeline Server Actions
// (requestImageUpload, registerPageAsset, getAssetReadUrl), mirroring
// SavePagePort's pattern (design.md, "notebooks como único puerto de
// persistencia hacia el editor"). Passed in as a prop from the page route
// (the composition root that already imports @/modules/notebooks), never
// imported by value inside editor/ui — see save-page-port.ts's comment on
// why a value import of that barrel would pull the server-only
// application/actions graph into the editor's client bundle. The actual
// byte upload to Storage (`uploadToSignedUrl`) is not part of this port:
// it must run entirely in the browser (design.md, "Subida directa desde
// el navegador") and cannot be a Server Action.
export interface ImageUploadPort {
  requestUpload(input: {
    pageId: string;
    mime: string;
    sizeBytes: number;
  }): Promise<Result<ImageUploadGrant, ActionError>>;
  register(input: {
    pageId: string;
    storagePath: string;
    mime: string;
    sizeBytes: number;
  }): Promise<Result<PageAssetSummary, ActionError>>;
  getReadUrl(input: {
    assetId: string;
  }): Promise<Result<{ url: string }, ActionError>>;
}
