import { z } from "zod";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { ASSET_ERROR } from "../domain/errors";
import type { PageAssetRepository } from "../domain/page-asset-repository";
import type { StorageGateway } from "../domain/storage-gateway";
import { parseInput } from "./validation";

export const getAssetReadUrlSchema = z.object({ assetId: z.string() });

// specs/page-assets/spec.md, "URLs de lectura firmadas de corta duración":
// at most 1h, only for the session's own assets, never persisted.
const READ_URL_TTL_SECONDS = 60 * 60;

export async function getAssetReadUrl(
  input: unknown,
  deps: { assets: PageAssetRepository; storage: StorageGateway },
  ownerId: string,
): Promise<Result<{ url: string }, DomainError>> {
  const parsed = parseInput(getAssetReadUrlSchema, input);
  if (!parsed.ok) return parsed;

  const asset = await deps.assets.findById(parsed.value.assetId);
  if (!asset || asset.ownerId !== ownerId) {
    return err(new DomainError(ASSET_ERROR.FORBIDDEN, parsed.value.assetId));
  }

  const url = await deps.storage.createSignedUrl(
    asset.storagePath,
    READ_URL_TTL_SECONDS,
  );
  return ok({ url });
}
