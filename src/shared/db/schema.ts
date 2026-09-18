import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// profiles mirrors auth.users (same id). Rows are created by the
// EnsureProfile use case, never by a database trigger (design.md).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name"),
  locale: text("locale").notNull().default("es"),
  timezone: text("timezone").notNull().default("UTC"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
