import { createClient } from "@supabase/supabase-js";

// DB tests need a real auth.users row because profiles.id now carries a
// foreign key to it (drizzle/0002_profiles_auth_fk.sql); notebooks/pages/
// page_assets all reference profiles.id in turn. This mirrors
// tests/e2e/fixtures/auth.ts's admin.createUser path, but for Vitest DB
// tests instead of Playwright.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface TestOwner {
  id: string;
  email: string;
}

export async function createTestOwner(prefix: string): Promise<TestOwner> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@cogni-db-test.test`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: "Secreta-123",
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error("admin.createUser returned no user");
  return { id: data.user.id, email };
}

export async function deleteTestOwner(id: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(id);
}
