import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/kernel/result";
import {
  DocumentImportProvider,
  useDocumentImport,
  useNotebookImport,
} from "./document-import-provider";

const { requestPdfUpload, startPdfImport } = vi.hoisted(() => ({
  requestPdfUpload: vi.fn(),
  startPdfImport: vi.fn(),
}));
vi.mock("../actions", () => ({ requestPdfUpload, startPdfImport }));

const { uploadDocumentToSignedUrl } = vi.hoisted(() => ({
  uploadDocumentToSignedUrl: vi.fn(),
}));
vi.mock("./upload-document-to-signed-url", () => ({
  uploadDocumentToSignedUrl,
}));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { add: addActiveImport } = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock("./active-imports-provider", () => ({
  useActiveImportsActions: () => ({ add: addActiveImport, remove: vi.fn() }),
}));

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

function makeFile(
  name = "apuntes.pdf",
  type = "application/pdf",
  sizeBytes = 1024,
): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function Probe({
  notebookId,
  onImported,
}: {
  notebookId: string;
  onImported?: () => void;
}) {
  const { start } = useDocumentImport();
  const state = useNotebookImport(notebookId);
  return (
    <div>
      <button
        type="button"
        onClick={() => start({ notebookId, onPageCreated: onImported })}
      >
        importar
      </button>
      <span data-testid={`status-${notebookId}`}>{state.status}</span>
      {state.error && (
        <span data-testid={`error-${notebookId}`}>{state.error}</span>
      )}
    </div>
  );
}

// Layout effects across a commit all run before any passive effect
// (React's commit ordering), so calling start() here fires strictly
// before DocumentImportProvider's own useEffect sets `mounted` to true and the
// hidden <input> is portaled — the one window where fileInputRef.current
// is genuinely null. Exercises the T10 follow-up guard
// (R3-start-null-ref-cast) that a synchronous DOM/RTL flush can never
// reach through a normal button click.
function LayoutStartProbe({ notebookId }: { notebookId: string }) {
  const { start } = useDocumentImport();
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires once on mount, before DocumentImportProvider's own effect mounts the hidden input
  useLayoutEffect(() => {
    start({ notebookId });
  }, []);
  return null;
}

async function pickFile(file: File) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "importar" }));
  const input = screen.getByTestId("document-import-input");
  await userEvent.upload(input, file);
}

describe("DocumentImportProvider", () => {
  beforeEach(() => {
    requestPdfUpload.mockReset();
    startPdfImport.mockReset();
    uploadDocumentToSignedUrl.mockReset();
    push.mockReset();
    captureException.mockReset();
    addActiveImport.mockReset();
  });

  it("portals the hidden file input outside the provider's subtree so a wrapping <nav> never contains it", async () => {
    render(
      <nav aria-label="Barra lateral">
        <DocumentImportProvider>
          <Probe notebookId="nb-1" />
        </DocumentImportProvider>
      </nav>,
    );
    const input = await screen.findByTestId("document-import-input");
    expect(input).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Barra lateral" }),
    ).not.toContainElement(input);
    expect(input.parentElement).toBe(document.body);
  });

  it("renders children and stays idle without any interaction", () => {
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
  });

  it("rejects a file that is neither PDF nor Word client-side without calling requestPdfUpload", async () => {
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "importar" }));
    // userEvent.upload() itself validates the file against the input's
    // `accept` attribute and silently no-ops for a mismatch; firing the
    // native change event directly is what actually exercises this
    // component's own client-side MIME check (the thing under test).
    fireEvent.change(screen.getByTestId("document-import-input"), {
      target: { files: [makeFile("foto.png", "image/png", 1024)] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "Solo puedes importar archivos PDF o Word (.docx).",
    );
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });

  // document-import T11: the picker offers PDF and Word, never PowerPoint
  // (its adapter lands in T7) nor a legacy .doc.
  it("accepts PDF and Word documents in the file input", async () => {
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    const input = await screen.findByTestId("document-import-input");
    expect(input).toHaveAttribute(
      "accept",
      ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it.each([
    [
      "a PowerPoint deck",
      "clase.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["a legacy Word document", "antiguo.doc", "application/msword"],
  ])("rejects %s client-side without calling requestPdfUpload", async (_case, name, type) => {
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "importar" }));
    fireEvent.change(screen.getByTestId("document-import-input"), {
      target: { files: [makeFile(name, type, 1024)] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
        "Solo puedes importar archivos PDF o Word (.docx).",
      ),
    );
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });

  it("imports a Word document, declaring and uploading it with its own mime", async () => {
    const docxMime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.docx",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue(
      ok({
        importJobId: "job-1",
        pageId: "page-1",
        notebookId: "nb-1",
        status: "queued",
      }),
    );
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile("apuntes.docx", docxMime));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/notebooks/nb-1/pages/page-1"),
    );
    expect(requestPdfUpload).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "apuntes.docx", mime: docxMime }),
    );
    expect(uploadDocumentToSignedUrl).toHaveBeenCalledWith(
      "page-pdfs",
      "owner-1/upload-1.docx",
      "token-1",
      expect.any(File),
      docxMime,
    );
    expect(startPdfImport).toHaveBeenCalledWith(
      expect.objectContaining({ mime: docxMime }),
    );
  });

  it("shows the rate-limit message when the start is refused for the import limit", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue({
      ok: false,
      error: { code: "INGESTION_RATE_LIMITED", message: "import starts" },
    });
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Llegaste al límite de importaciones por ahora. Intenta de nuevo más tarde.",
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects a file over 20 MiB client-side without calling requestPdfUpload", async () => {
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile("grande.pdf", "application/pdf", 20_971_521));

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "El documento supera el límite de 20 MB.",
    );
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });

  it("runs upload -> queued -> navigate on a full success and clears the banner", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue(
      ok({
        importJobId: "job-1",
        pageId: "page-1",
        notebookId: "nb-1",
        status: "queued",
      }),
    );
    const onImported = vi.fn();

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" onImported={onImported} />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/notebooks/nb-1/pages/page-1"),
    );
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
    expect(requestPdfUpload).toHaveBeenCalledWith({
      notebookId: "nb-1",
      fileName: "apuntes.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    });
    expect(uploadDocumentToSignedUrl).toHaveBeenCalledWith(
      "page-pdfs",
      "owner-1/upload-1.pdf",
      "token-1",
      expect.any(File),
      "application/pdf",
    );
    expect(startPdfImport).toHaveBeenCalledWith({
      notebookId: "nb-1",
      storagePath: "owner-1/upload-1.pdf",
      fileName: "apuntes.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    });
  });

  it("marks the new page as actively importing right after startPdfImport succeeds (T13a)", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue(
      ok({
        importJobId: "job-1",
        pageId: "page-1",
        notebookId: "nb-1",
        status: "queued",
      }),
    );

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() => expect(addActiveImport).toHaveBeenCalledWith("page-1"));
    expect(push).toHaveBeenCalledWith("/notebooks/nb-1/pages/page-1");
  });

  it("does not mark a page as importing when startPdfImport fails", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue({
      ok: false,
      error: { code: "DOCUMENT_UPLOAD_EXPIRED", message: "expired" },
    });

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(addActiveImport).not.toHaveBeenCalled();
  });

  it("shows the uploading state and an import-progress region above the children while requestPdfUpload is in flight", async () => {
    let resolveGrant: (value: unknown) => void = () => {};
    requestPdfUpload.mockReturnValue(
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
    );

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("uploading"),
    );
    expect(screen.getByTestId("import-progress")).toHaveAttribute(
      "data-status",
      "uploading",
    );

    // Let the flow finish so no promise is left dangling past the test.
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue(
      ok({
        importJobId: "job-1",
        pageId: "page-1",
        notebookId: "nb-1",
        status: "queued",
      }),
    );
    resolveGrant(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle"),
    );
  });

  it("stays without navigating and shows the mapped error when requestPdfUpload fails", async () => {
    requestPdfUpload.mockResolvedValue({
      ok: false,
      error: { code: "INGESTION_NOTEBOOK_NOT_FOUND", message: "nb missing" },
    });

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "No encontramos ese cuaderno.",
    );
    expect(push).not.toHaveBeenCalled();
    expect(uploadDocumentToSignedUrl).not.toHaveBeenCalled();
  });

  it("reports the upload failure to Sentry and shows a failed banner without calling startPdfImport", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    const uploadError = new Error("network down");
    uploadDocumentToSignedUrl.mockResolvedValue({
      ok: false,
      error: uploadError,
    });

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(captureException).toHaveBeenCalledWith(uploadError);
    expect(startPdfImport).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("stays without navigating and shows the mapped error when startPdfImport fails", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue({
      ok: false,
      error: { code: "DOCUMENT_UPLOAD_EXPIRED", message: "expired" },
    });

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a rejected requestPdfUpload call to Sentry and ends in failed with the generic copy (T10 follow-up)", async () => {
    requestPdfUpload.mockRejectedValue(new Error("network down"));

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "No pudimos completar la importación. Inténtalo de nuevo.",
    );
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(uploadDocumentToSignedUrl).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a throwing uploadDocumentToSignedUrl helper to Sentry and ends in failed with the generic copy (T10 follow-up)", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockRejectedValue(new Error("xhr exploded"));

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "No pudimos completar la importación. Inténtalo de nuevo.",
    );
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(startPdfImport).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a rejected startPdfImport call to Sentry and ends in failed with the generic copy (T10 follow-up)", async () => {
    requestPdfUpload.mockResolvedValue(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockRejectedValue(new Error("db down"));

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(push).not.toHaveBeenCalled();
  });

  it("start() called before the hidden input mounts is a harmless no-op (T10 follow-up: R3-start-null-ref-cast)", () => {
    expect(() =>
      render(
        <DocumentImportProvider>
          <LayoutStartProbe notebookId="nb-1" />
        </DocumentImportProvider>,
      ),
    ).not.toThrow();
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });

  it("stays idle (not busy) for a second notebook when the first one's banner is a terminal failed state", async () => {
    requestPdfUpload.mockResolvedValue({
      ok: false,
      error: { code: "INGESTION_NOTEBOOK_NOT_FOUND", message: "nb missing" },
    });

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
        <Probe notebookId="nb-2" />
      </DocumentImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "importar" })[0] as HTMLElement,
    );
    const input = screen.getByTestId("document-import-input");
    await userEvent.upload(input, makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("status-nb-2")).toHaveTextContent("idle");
  });

  it("enforces one import at a time: a second notebook reports busy and start() is a no-op while the first is uploading (T10 follow-up)", async () => {
    let resolveGrant: (value: unknown) => void = () => {};
    requestPdfUpload.mockReturnValue(
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
    );

    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
        <Probe notebookId="nb-2" />
      </DocumentImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "importar" })[0] as HTMLElement,
    );
    const input = screen.getByTestId("document-import-input");
    await userEvent.upload(input, makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("uploading"),
    );
    expect(screen.getByTestId("status-nb-2")).toHaveTextContent("busy");

    // start() for the busy notebook is a no-op: no second requestPdfUpload
    // call, no file dialog re-trigger, banner stays exactly nb-1's.
    await user.click(
      screen.getAllByRole("button", { name: "importar" })[1] as HTMLElement,
    );
    expect(requestPdfUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("uploading");
    expect(screen.getByTestId("status-nb-2")).toHaveTextContent("busy");

    uploadDocumentToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue(
      ok({
        importJobId: "job-1",
        pageId: "page-1",
        notebookId: "nb-1",
        status: "queued",
      }),
    );
    resolveGrant(
      ok({
        storagePath: "owner-1/upload-1.pdf",
        signedUrl: "https://signed.example/upload",
        token: "token-1",
        bucket: "page-pdfs",
        expiresAt: new Date().toISOString(),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle"),
    );
    expect(screen.getByTestId("status-nb-2")).toHaveTextContent("idle");
  });

  it("does nothing when the file picker is cancelled (no file selected)", async () => {
    render(
      <DocumentImportProvider>
        <Probe notebookId="nb-1" />
      </DocumentImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "importar" }));
    const input = screen.getByTestId(
      "document-import-input",
    ) as HTMLInputElement;
    // Simulate the native picker being dismissed: change fires with no files.
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });
});

describe("useDocumentImport/useNotebookImport without a mounted provider", () => {
  it("returns the idle state so every consumer works standalone", () => {
    render(<Probe notebookId="nb-1" />);
    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
  });

  it("start() is a harmless no-op with no provider mounted", async () => {
    const user = userEvent.setup();
    render(<Probe notebookId="nb-1" />);

    await expect(
      user.click(screen.getByRole("button", { name: "importar" })),
    ).resolves.not.toThrow();
    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
  });
});
