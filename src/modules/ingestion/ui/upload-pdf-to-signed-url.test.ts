import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors editor/ui/tiptap/upload-to-signed-url.ts: a minimal browser-only
// Supabase client built from public env vars only, never the service role
// key (design.md, "Subida directa desde el navegador").
const { uploadToSignedUrl, from, createBrowserClient } = vi.hoisted(() => {
  const uploadToSignedUrl = vi.fn();
  const from = vi.fn(() => ({ uploadToSignedUrl }));
  const createBrowserClient = vi.fn(() => ({ storage: { from } }));
  return { uploadToSignedUrl, from, createBrowserClient };
});

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
  }),
}));

function makeFile(): File {
  return new File([new Uint8Array(10)], "notas.pdf", {
    type: "application/pdf",
  });
}

describe("uploadPdfToSignedUrl", () => {
  beforeEach(() => {
    uploadToSignedUrl.mockReset();
    from.mockClear();
    createBrowserClient.mockClear();
  });

  it("uploads the file to the signed url with the pdf content type and never leaks the service role key", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: null });
    const { uploadPdfToSignedUrl } = await import("./upload-pdf-to-signed-url");
    const file = makeFile();

    const result = await uploadPdfToSignedUrl(
      "page-pdfs",
      "owner-1/upload-1.pdf",
      "token-1",
      file,
    );

    expect(result.ok).toBe(true);
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "public-key",
    );
    expect(from).toHaveBeenCalledWith("page-pdfs");
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      "owner-1/upload-1.pdf",
      "token-1",
      file,
      { contentType: "application/pdf" },
    );
  });

  it("returns a typed failure on a non-2xx / error response instead of throwing", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: new Error("upload failed") });
    const { uploadPdfToSignedUrl } = await import("./upload-pdf-to-signed-url");

    const result = await uploadPdfToSignedUrl(
      "page-pdfs",
      "owner-1/upload-1.pdf",
      "token-1",
      makeFile(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("upload failed");
  });
});
