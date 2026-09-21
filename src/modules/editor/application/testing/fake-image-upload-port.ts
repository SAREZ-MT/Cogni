import type { ActionError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type {
  ImageUploadGrant,
  ImageUploadPort,
  PageAssetSummary,
} from "../../domain/image-upload-port";

// In-memory double of ImageUploadPort for image-node.test.tsx: no network,
// no Server Action. Mirrors FakeSavePagePort's pattern.
export class FakeImageUploadPort implements ImageUploadPort {
  readonly requestUploadCalls: Array<{
    pageId: string;
    mime: string;
    sizeBytes: number;
  }> = [];
  readonly registerCalls: Array<{
    pageId: string;
    storagePath: string;
    mime: string;
    sizeBytes: number;
  }> = [];
  readonly getReadUrlCalls: string[] = [];

  private assetCounter = 0;

  async requestUpload(input: {
    pageId: string;
    mime: string;
    sizeBytes: number;
  }): Promise<Result<ImageUploadGrant, ActionError>> {
    this.requestUploadCalls.push(input);
    return ok({
      storagePath: `owner/${input.pageId}/fake-asset.png`,
      signedUrl: "https://fake.local/upload",
      token: "fake-token",
      bucket: "fake-bucket",
    });
  }

  async register(input: {
    pageId: string;
    storagePath: string;
    mime: string;
    sizeBytes: number;
  }): Promise<Result<PageAssetSummary, ActionError>> {
    this.registerCalls.push(input);
    this.assetCounter += 1;
    return ok({
      id: `asset-${this.assetCounter}`,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
    });
  }

  async getReadUrl(input: {
    assetId: string;
  }): Promise<Result<{ url: string }, ActionError>> {
    this.getReadUrlCalls.push(input.assetId);
    return ok({ url: `https://fake.local/read/${input.assetId}` });
  }
}

export function failingImageUploadPort(): ImageUploadPort {
  return {
    async requestUpload() {
      return err({ code: "ASSET_FORBIDDEN", message: "denied" });
    },
    async register() {
      return err({ code: "ASSET_FORBIDDEN", message: "denied" });
    },
    async getReadUrl() {
      return err({ code: "ASSET_FORBIDDEN", message: "denied" });
    },
  };
}
