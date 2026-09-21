import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/shared/config/env.client";

// The actual byte upload direct to Storage (design.md, "Subida directa
// desde el navegador"): never a Server Action, so it cannot be part of
// ImageUploadPort. identity/infrastructure/supabase-browser-client.ts is
// not reachable here — identity's public index.ts is server-only
// (`import "server-only"`), and `ui-never-touches-infra`
// (.dependency-cruiser.cjs) forbids importing another module's
// infrastructure path directly — so this is a minimal, editor-local
// browser client using only public env vars (never the service role key).
export async function uploadToSignedUrl(
  bucket: string,
  storagePath: string,
  token: string,
  file: File,
): Promise<{ error: Error | null }> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    clientEnv();
  const supabase = createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(storagePath, token, file);
  return { error: error ?? null };
}
