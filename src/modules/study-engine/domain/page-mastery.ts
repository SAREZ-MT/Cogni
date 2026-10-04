import type { MasteryLevel } from "./mastery";

// Persisted page-level aggregate (§6.1) read by the calendar and the
// dashboard; recomputed after every review and by the daily job.
export interface PageMastery {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly level: MasteryLevel;
  readonly score: number;
  readonly itemsTotal: number;
  readonly itemsDue: number;
  readonly computedAt: Date;
}
