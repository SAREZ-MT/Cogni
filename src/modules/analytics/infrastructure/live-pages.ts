import { isNull } from "drizzle-orm";
import { notebooks, pages } from "@/shared/db/schema";

// Every dashboard read joins the page and its notebook and skips archived
// ones, as the calendar does.
export const livePage = [
  isNull(pages.archivedAt),
  isNull(notebooks.archivedAt),
];
