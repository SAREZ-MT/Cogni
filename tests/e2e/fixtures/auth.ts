import { test as base, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TERMS_VERSION } from "@/modules/identity/domain/terms";

// Real Supabase project (cogni-dev) drives these flows. Without its env the
// auth suites skip instead of failing, so `pnpm test:e2e` still runs the
// public-layout checks on a PR without secrets.
export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@cogni-e2e.test`;
}

// The "verification stub" from design.md: the admin API confirms the email
// so the flow under test starts at a verified account.
//
// By default the user also arrives with the CURRENT terms already accepted:
// the (app) layout redirects accounts that have not accepted to /terminos,
// which would otherwise intercept every spec that signs in. The profiles
// row is written through the service-role client (RLS has no policies and
// the service role bypasses it); the app's own ensureProfile then finds it
// and leaves it untouched. `{ acceptTerms: false }` skips this so the
// terms-acceptance spec can exercise the gate with a brand-new account.
export async function createVerifiedUser(
  options: { acceptTerms?: boolean } = {},
): Promise<TestUser> {
  const { acceptTerms = true } = options;
  const email = uniqueEmail("verified");
  const password = "Secreta-123";
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error("admin.createUser returned no user");
  if (acceptTerms) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      terms_accepted_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;
  }
  return { id: data.user.id, email, password };
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((candidate) => candidate.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

export async function submitSignIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await submitSignIn(page, user);
  await expect(page).toHaveURL("/");
}

// Worker-scoped verified user shared by every shell test in that worker,
// plus a test-scoped one for scenarios that need an owner with no data at
// all (the worker user accumulates notebooks across specs).
export const test = base.extend<
  { freshUser: TestUser; unacceptedUser: TestUser },
  { verifiedUser: TestUser }
>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
  freshUser: async ({}, use) => {
    const user = await createVerifiedUser();
    await use(user);
    await deleteUserByEmail(user.email);
  },
  // Verified account that has NOT accepted the terms (see createVerifiedUser).
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
  unacceptedUser: async ({}, use) => {
    const user = await createVerifiedUser({ acceptTerms: false });
    await use(user);
    await deleteUserByEmail(user.email);
  },
  verifiedUser: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
    async ({}, use) => {
      const user = await createVerifiedUser();
      await use(user);
      await deleteUserByEmail(user.email);
    },
    { scope: "worker" },
  ],
});

export { expect };

// Next.js renders its own `[role="alert"]` route announcer, so a bare
// `getByRole("alert")` is ambiguous under strict mode. Target the form one.
export function formAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
