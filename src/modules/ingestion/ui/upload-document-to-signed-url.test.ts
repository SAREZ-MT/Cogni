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

describe("uploadDocumentToSignedUrl", () => {
  beforeEach(() => {
    uploadToSignedUrl.mockReset();
    from.mockClear();
    createBrowserClient.mockClear();
  });

  it("uploads the file to the signed url with the pdf content type and never leaks the service role key", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: null });
    const { uploadDocumentToSignedUrl } = await import(
      "./upload-document-to-signed-url"
    );
    const file = makeFile();

    const result = await uploadDocumentToSignedUrl(
      "page-pdfs",
      "owner-1/upload-1.pdf",
      "token-1",
      file,
      "application/pdf",
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

  // document-import T11: the object is stored with the file's real type,
  // so a Word upload is not labelled application/pdf.
  it("uploads a Word document with its own content type", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: null });
    const { uploadDocumentToSignedUrl } = await import(
      "./upload-document-to-signed-url"
    );
    const docxMime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const file = new File([new Uint8Array(10)], "notas.docx", {
      type: docxMime,
    });

    await uploadDocumentToSignedUrl(
      "page-pdfs",
      "owner-1/upload-1.docx",
      "token-1",
      file,
      docxMime,
    );

    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      "owner-1/upload-1.docx",
      "token-1",
      file,
      { contentType: docxMime },
    );
  });

  it("returns a typed failure on a non-2xx / error response instead of throwing", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: new Error("upload failed") });
    const { uploadDocumentToSignedUrl } = await import(
      "./upload-document-to-signed-url"
    );

    const result = await uploadDocumentToSignedUrl(
      "page-pdfs",
      "owner-1/upload-1.pdf",
      "token-1",
      makeFile(),
      "application/pdf",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("upload failed");
  });
});
