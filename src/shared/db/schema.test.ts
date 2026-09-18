import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { profiles } from "./schema";

describe("profiles table", () => {
  // The publishable key reaches the browser, so PostgREST exposes every
  // public table without RLS. The app only reads profiles through the
  // server connection, which bypasses RLS; nobody else may touch the rows.
  it("enables row level security so PostgREST cannot expose rows", () => {
    expect(getTableConfig(profiles).enableRLS).toBe(true);
  });
});
