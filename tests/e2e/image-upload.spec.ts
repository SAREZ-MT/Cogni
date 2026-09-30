import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { pageAssets } from "@/shared/db/schema";
import { createTestDb } from "../db/helpers/test-db";
import {
  createVerifiedUser,
  deleteUserByEmail,
  expect,
  hasSupabaseEnv,
  signIn,
  type TestUser,
  test,
} from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { buildPng } from "./helpers/png";

// specs/page-assets/spec.md: "Subida y renderizado", "Lectura entre
// usuarios denegada", "Acceso anónimo denegado" and "Subida que excede el
// límite del bucket rechazada".
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "page-assets";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signedInClient(user: TestUser) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return client;
}

async function createNotebookAndPage(page: import("@playwright/test").Page) {
  const title = `Imagenes ${randomUUID().slice(0, 8)}`;
  await createNotebookWithOpenPage(page, title);

  const editorMount = page.getByTestId("editor-mount");
  await expect(editorMount).toBeVisible();
  return {
    editorMount,
    pageId: await editorMount.getAttribute("data-page-id"),
  };
}

test.describe("image upload pipeline", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("uploads a PNG, renders it, and it survives a reload (Scenario: Subida y renderizado)", async ({
    page,
  }) => {
    const { editorMount } = await createNotebookAndPage(page);
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/imagen");
    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Enter");

    const fileInput = editorMount.getByTestId("image-node-input");
    const png = buildPng(2 * 1024 * 1024);
    await fileInput.setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: png,
    });

    const img = editorMount.getByTestId("image-node-img");
    await expect(img).toBeVisible({ timeout: 20000 });
    const src = await img.getAttribute("src");
    expect(src).toContain("/storage/v1/object/sign/");

    // S7 (odd/tasks/app-shell-restyle.md, drift #1): the status now
    // portals into the page header's meta row instead of rendering inside
    // `editor-mount` (editor/ui/tiptap/editor.tsx's `statusPortalId`).
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });
    await page.reload();
    await expect(
      page.getByTestId("editor-mount").getByTestId("image-node-img"),
    ).toBeVisible({ timeout: 20000 });
  });

  test("a second user cannot read the first user's asset, and anonymous access is denied (Scenarios: Lectura entre usuarios denegada, Acceso anónimo denegado)", async ({
    page,
    verifiedUser,
  }) => {
    const { editorMount, pageId } = await createNotebookAndPage(page);
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/imagen");
    await expect(page.getByTestId("command-menu")).toBeVisible();
    await page.keyboard.press("Enter");

    const fileInput = editorMount.getByTestId("image-node-input");
    await fileInput.setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: buildPng(1024 * 1024),
    });
    await expect(editorMount.getByTestId("image-node-img")).toBeVisible({
      timeout: 20000,
    });

    const db = createTestDb();
    const [asset] = await db
      .select()
      .from(pageAssets)
      .where(eq(pageAssets.pageId, pageId as string));
    expect(asset).toBeDefined();
    const storagePath = asset.storagePath;

    let otherUser: TestUser | undefined;
    try {
      otherUser = await createVerifiedUser();
      const otherClient = await signedInClient(otherUser);
      const { data: otherData, error: otherError } = await otherClient.storage
        .from(BUCKET)
        .download(storagePath);
      expect(otherData).toBeNull();
      expect(otherError).not.toBeNull();

      const { data: anonData, error: anonError } = await anonClient()
        .storage.from(BUCKET)
        .download(storagePath);
      expect(anonData).toBeNull();
      expect(anonError).not.toBeNull();
    } finally {
      if (otherUser) await deleteUserByEmail(otherUser.email);
    }
    void verifiedUser;
  });

  test("an 11 MB upload with a valid grant is rejected by Storage and no row is persisted (Scenario: Subida que excede el límite del bucket rechazada)", async ({
    page,
    verifiedUser,
  }) => {
    const { pageId } = await createNotebookAndPage(page);
    void page;

    const client = await signedInClient(verifiedUser);
    const assetId = randomUUID();
    const storagePath = `${verifiedUser.id}/${pageId}/${assetId}.png`;

    const { data: grant, error: grantError } = await client.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);
    expect(grantError).toBeNull();
    if (!grant) throw new Error("no signed upload grant issued");

    const oversized = buildPng(11 * 1024 * 1024);
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .uploadToSignedUrl(storagePath, grant.token, oversized, {
        contentType: "image/png",
      });
    expect(uploadError).not.toBeNull();

    const db = createTestDb();
    const [row] = await db
      .select()
      .from(pageAssets)
      .where(eq(pageAssets.storagePath, storagePath));
    expect(row).toBeUndefined();
  });

  // specs/page-assets/spec.md, "Subida que excede el límite del bucket
  // rechazada (e2e)": the same scenario covers an object "de 11 MB o de
  // otro tipo". The app's own upload pipeline (image-node.tsx's
  // validateClientSide, mirroring the server's authoritative allow-list)
  // rejects a disallowed MIME before ever requesting an upload grant.
  test("a disallowed MIME type is rejected by the app's own upload pipeline and no row is persisted (Scenario: Subida que excede el límite del bucket rechazada)", async ({
    page,
  }) => {
    const { editorMount, pageId } = await createNotebookAndPage(page);
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/imagen");
    await expect(page.getByTestId("command-menu")).toBeVisible();
    await page.keyboard.press("Enter");

    const fileInput = editorMount.getByTestId("image-node-input");
    await fileInput.setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });

    await expect(editorMount.getByTestId("image-node-error")).toHaveText(
      "Ese tipo de archivo no está permitido.",
    );
    await expect(editorMount.getByTestId("image-node-img")).toHaveCount(0);

    const db = createTestDb();
    const rows = await db
      .select()
      .from(pageAssets)
      .where(eq(pageAssets.pageId, pageId as string));
    expect(rows).toHaveLength(0);
  });
});
