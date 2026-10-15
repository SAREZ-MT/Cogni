import {
  CONSOLIDATING_THRESHOLD,
  MASTERED_THRESHOLD,
} from "@/shared/kernel/mastery-thresholds";
import type { StudyItem } from "./study-item";

// Page mastery v1 exactly as documento-maestro §7.3. Pure; adjusted only by
// ADR with real data.

export const MASTERY_LEVELS = [
  "Nuevo",
  "Aprendiendo",
  "Consolidando",
  "Dominado",
] as const;

export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

// Days of interval at which an item counts as fully stable.
export const STABILITY_HORIZON_DAYS = 21;
// The band thresholds live in shared/kernel (also used by shared/ui's
// masteryLevelFromScore); re-exported so study-engine's public names stay.
export { CONSOLIDATING_THRESHOLD, MASTERED_THRESHOLD };

export type MasteryInput = Pick<
  StudyItem,
  "intervalDays" | "lastQuality" | "dueAt" | "suspendedAt"
>;

export interface MasterySnapshot {
  readonly level: MasteryLevel;
  readonly score: number;
  readonly itemsTotal: number;
  readonly itemsDue: number;
}

export function computeMastery(
  items: ReadonlyArray<MasteryInput>,
  now: Date,
): MasterySnapshot {
  const active = items.filter((item) => item.suspendedAt === null);

  if (active.length === 0) {
    return { level: "Nuevo", score: 0, itemsTotal: 0, itemsDue: 0 };
  }

  let sum = 0;
  let itemsDue = 0;
  for (const item of active) {
    const stability = Math.min(1, item.intervalDays / STABILITY_HORIZON_DAYS);
    const hit = item.lastQuality !== null && item.lastQuality >= 3 ? 1 : 0;
    sum += 0.6 * stability + 0.4 * hit;
    if (item.dueAt.getTime() <= now.getTime()) itemsDue += 1;
  }
  const score = sum / active.length;

  return { level: levelFor(score), score, itemsTotal: active.length, itemsDue };
}

function levelFor(score: number): MasteryLevel {
  if (score < CONSOLIDATING_THRESHOLD) return "Aprendiendo";
  if (score < MASTERED_THRESHOLD) return "Consolidando";
  return "Dominado";
}
