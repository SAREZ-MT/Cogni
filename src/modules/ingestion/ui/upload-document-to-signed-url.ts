import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/shared/config/env.client";
import { err, ok, type Result } from "@/shared/kernel/result";

// The actual byte upload direct to Storage (design.md, "Subida directa
// desde el navegador"): never a Server Action, so it cannot be part of a
// port ingestion's application layer could depend on. Mirrors
// editor/ui/tiptap/upload-to-signed-url.ts exactly: identity's public
// index.ts is server-only (`import "server-only"`), and
// `ui-never-touches-infra` (.dependency-cruiser.cjs) forbids importing
// another module's infrastructure path directly, so this is a minimal,
// ingestion-local browser client using only public env vars (never the
// service role key). `contentType` is the mime the upload grant was
// requested for (import-formats.ts's `importMimeOf`), so a Word document
// is stored as one instead of as application/pdf (document-import T11).
export async function uploadDocumentToSignedUrl(
  bucket: string,
  storagePath: string,
  token: string,
  file: File,
  contentType: string,
): Promise<Result<void, Error>> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    clientEnv();
  const supabase = createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(storagePath, token, file, { contentType });
  if (error) return err(error);
  return ok(undefined);
}
