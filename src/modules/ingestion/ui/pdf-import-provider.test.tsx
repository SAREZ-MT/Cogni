import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/kernel/result";
import {
  PdfImportProvider,
  useNotebookImport,
  usePdfImport,
} from "./pdf-import-provider";

const { requestPdfUpload, startPdfImport } = vi.hoisted(() => ({
  requestPdfUpload: vi.fn(),
  startPdfImport: vi.fn(),
}));
vi.mock("../actions", () => ({ requestPdfUpload, startPdfImport }));

const { uploadPdfToSignedUrl } = vi.hoisted(() => ({
  uploadPdfToSignedUrl: vi.fn(),
}));
vi.mock("./upload-pdf-to-signed-url", () => ({ uploadPdfToSignedUrl }));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
  const { start } = usePdfImport();
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

async function pickFile(file: File) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "importar" }));
  const input = screen.getByTestId("pdf-import-input");
  await userEvent.upload(input, file);
}

describe("PdfImportProvider", () => {
  beforeEach(() => {
    requestPdfUpload.mockReset();
    startPdfImport.mockReset();
    uploadPdfToSignedUrl.mockReset();
    push.mockReset();
    captureException.mockReset();
  });

  it("portals the hidden file input outside the provider's subtree so a wrapping <nav> never contains it", async () => {
    render(
      <nav aria-label="Barra lateral">
        <PdfImportProvider>
          <Probe notebookId="nb-1" />
        </PdfImportProvider>
      </nav>,
    );
    const input = await screen.findByTestId("pdf-import-input");
    expect(input).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Barra lateral" }),
    ).not.toContainElement(input);
    expect(input.parentElement).toBe(document.body);
  });

  it("renders children and stays idle without any interaction", () => {
    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
    );

    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
  });

  it("rejects a non-PDF file client-side without calling requestPdfUpload", async () => {
    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "importar" }));
    // userEvent.upload() itself validates the file against the input's
    // `accept` attribute and silently no-ops for a mismatch; firing the
    // native change event directly is what actually exercises this
    // component's own client-side MIME check (the thing under test).
    fireEvent.change(screen.getByTestId("pdf-import-input"), {
      target: { files: [makeFile("foto.png", "image/png", 1024)] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "solo puedes importar archivos PDF",
    );
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });

  it("rejects a file over 20 MiB client-side without calling requestPdfUpload", async () => {
    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
    );

    await pickFile(makeFile("grande.pdf", "application/pdf", 20_971_521));

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "el PDF supera el límite de 20 MB",
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
    uploadPdfToSignedUrl.mockResolvedValue(ok(undefined));
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
      <PdfImportProvider>
        <Probe notebookId="nb-1" onImported={onImported} />
      </PdfImportProvider>,
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
    expect(uploadPdfToSignedUrl).toHaveBeenCalledWith(
      "page-pdfs",
      "owner-1/upload-1.pdf",
      "token-1",
      expect.any(File),
    );
    expect(startPdfImport).toHaveBeenCalledWith({
      notebookId: "nb-1",
      storagePath: "owner-1/upload-1.pdf",
      fileName: "apuntes.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    });
  });

  it("shows the uploading state and an import-progress region above the children while requestPdfUpload is in flight", async () => {
    let resolveGrant: (value: unknown) => void = () => {};
    requestPdfUpload.mockReturnValue(
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
    );

    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
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
    uploadPdfToSignedUrl.mockResolvedValue(ok(undefined));
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
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(screen.getByTestId("error-nb-1")).toHaveTextContent(
      "No encontramos ese cuaderno.",
    );
    expect(push).not.toHaveBeenCalled();
    expect(uploadPdfToSignedUrl).not.toHaveBeenCalled();
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
    uploadPdfToSignedUrl.mockResolvedValue({ ok: false, error: uploadError });

    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
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
    uploadPdfToSignedUrl.mockResolvedValue(ok(undefined));
    startPdfImport.mockResolvedValue({
      ok: false,
      error: { code: "PDF_UPLOAD_EXPIRED", message: "expired" },
    });

    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
    );

    await pickFile(makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("failed"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps a second notebook idle while the first one is importing", async () => {
    let resolveGrant: (value: unknown) => void = () => {};
    requestPdfUpload.mockReturnValue(
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
    );

    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
        <Probe notebookId="nb-2" />
      </PdfImportProvider>,
    );

    await userEvent
      .setup()
      .click(
        screen.getAllByRole("button", { name: "importar" })[0] as HTMLElement,
      );
    const input = screen.getByTestId("pdf-import-input");
    await userEvent.upload(input, makeFile());

    await waitFor(() =>
      expect(screen.getByTestId("status-nb-1")).toHaveTextContent("uploading"),
    );
    expect(screen.getByTestId("status-nb-2")).toHaveTextContent("idle");

    uploadPdfToSignedUrl.mockResolvedValue(ok(undefined));
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

  it("does nothing when the file picker is cancelled (no file selected)", async () => {
    render(
      <PdfImportProvider>
        <Probe notebookId="nb-1" />
      </PdfImportProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "importar" }));
    const input = screen.getByTestId("pdf-import-input") as HTMLInputElement;
    // Simulate the native picker being dismissed: change fires with no files.
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(screen.getByTestId("status-nb-1")).toHaveTextContent("idle");
    expect(requestPdfUpload).not.toHaveBeenCalled();
  });
});

describe("usePdfImport/useNotebookImport without a mounted provider", () => {
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
