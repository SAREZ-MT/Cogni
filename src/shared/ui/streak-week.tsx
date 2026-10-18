"use client";

import { Check, Flame } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/ui/utils";

export interface StreakWeekDay {
  // Stable key, e.g. the local day "2026-10-18".
  key: string;
  // Visible one-letter initial ("L", "M", …).
  initial: string;
  // Full name for screen readers ("lunes").
  name: string;
  studied: boolean;
  isToday: boolean;
}

export interface StreakWeekProps {
  streakDays: number;
  // Oldest first; Home passes the last 7 local days ending today.
  days: readonly StreakWeekDay[];
  helper: string;
  className?: string;
}

export function streakLabel(streakDays: number): string {
  return `${streakDays} ${streakDays === 1 ? "día seguido" : "días seguidos"}`;
}

const MILESTONES = [
  { days: 7, goal: "tu primera semana" },
  { days: 30, goal: "llegar a 30" },
  { days: 100, goal: "llegar a 100" },
] as const;

// "4 días más para tu primera semana": the next milestone while a streak is
// alive; none before the first review and none past 100.
export function milestoneHint(streakDays: number): string | null {
  if (streakDays <= 0) return null;
  const next = MILESTONES.find(({ days }) => streakDays < days);
  if (!next) return null;
  const left = next.days - streakDays;
  return `${left} ${left === 1 ? "día más" : "días más"} para ${next.goal}`;
}

// Entrance timing (seconds): the reviewed days fill in left to right, the
// links between them draw after their day, then the flame flickers on.
const DAY_START = 0.1;
const DAY_STAGGER = 0.05;

// Day-streak block of the Home hero (Phase 8 H2-T5b; references: Duolingo's
// lit flame and week bar, habit-tracker check-in pills, GitHub's streak
// chain). A flame badge, dormant grey at 0 and lit amber with a streak,
// next to the big streak number; the week as a chain of day circles where
// reviewed days carry a check and consecutive ones are joined by a bar;
// today is a target ring that pulses softly a couple of times while it
// still has no review. Lit, the card gets a faint warm wash and glow.
// Every day also reads as text for screen readers; decoration is
// aria-hidden. Motion runs once (the pulse twice, then stops); under
// prefers-reduced-motion only the transitions change, never `initial`.
export function StreakWeek({
  streakDays,
  days,
  helper,
  className,
}: StreakWeekProps) {
  const reduce = useReducedMotion() ?? false;
  const lit = streakDays > 0;
  const milestone = milestoneHint(streakDays);
  const settle = (delay: number) =>
    reduce
      ? { duration: 0 }
      : { type: "spring" as const, bounce: 0.35, visualDuration: 0.3, delay };
  const flameDelay = DAY_START + days.length * DAY_STAGGER;
  const unit = streakDays === 1 ? "día seguido" : "días seguidos";

  return (
    <div
      data-slot="streak-week"
      data-state={lit ? "lit" : "dormant"}
      className={cn(
        "flex w-full max-w-[380px] flex-col gap-3 rounded-xl border px-4 py-3.5 transition-shadow",
        lit
          ? "border-warning-500/25 bg-gradient-to-br from-warning-50 via-card via-60% to-card shadow-lg shadow-warning-500/15"
          : "border-border-subtle bg-card shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <motion.span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-input",
            lit
              ? "bg-gradient-to-b from-warning-100 to-pastel-orange text-warning-600"
              : "bg-neutral-100 text-neutral-400",
          )}
          initial={{ scale: 0.8, rotate: 0 }}
          animate={
            lit
              ? { scale: [0.8, 1.1, 0.97, 1.03, 1], rotate: [0, -7, 5, -2, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.6, ease: "easeOut", delay: flameDelay }
          }
        >
          <Flame
            size={24}
            strokeWidth={1.75}
            className={lit ? "fill-warning-500/45" : undefined}
          />
        </motion.span>
        <div className="flex min-w-0 flex-col">
          <p aria-hidden="true" className="flex items-baseline gap-1.5">
            <span className="font-bold text-[28px] text-fg leading-none tracking-[-0.02em] tabular-nums">
              {streakDays}
            </span>
            <span className="font-medium text-[14px] text-fg-secondary">
              {unit}
            </span>
          </p>
          <span className="sr-only">{streakLabel(streakDays)}</span>
          <p className="mt-0.5 text-[13px] text-fg-secondary">{helper}</p>
        </div>
      </div>

      <ol aria-label="Últimos 7 días" className="grid grid-cols-7">
        {days.map((day, index) => {
          const linked = day.studied && days[index + 1]?.studied === true;
          const delay = DAY_START + index * DAY_STAGGER;
          const target = day.isToday && !day.studied;
          return (
            <li
              key={day.key}
              data-studied={day.studied}
              data-today={day.isToday || undefined}
              className="relative flex flex-col items-center gap-1"
            >
              {linked && (
                <motion.span
                  aria-hidden="true"
                  data-part="link"
                  className="absolute top-[12px] left-1/2 h-1 w-full origin-left rounded-pill bg-warning-500/40"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { duration: 0.2, ease: "easeOut", delay: delay + 0.08 }
                  }
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center rounded-full",
                  !day.studied && !target && "bg-neutral-150",
                  target &&
                    "border-2 border-warning-500/70 border-dashed bg-card",
                  day.studied &&
                    day.isToday &&
                    "ring-2 ring-warning-500/30 ring-offset-2",
                )}
              >
                {day.studied && (
                  <motion.span
                    data-part="check"
                    className="flex size-7 items-center justify-center rounded-full bg-warning-500 text-white"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={settle(delay)}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.span>
                )}
                {target && (
                  <motion.span
                    className="absolute inset-[-2px] rounded-full border-2 border-warning-500/50"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{ scale: 1.7, opacity: [0, 0.7, 0] }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 1.2,
                            ease: "easeOut",
                            repeat: 1,
                            delay: flameDelay + 0.3,
                          }
                    }
                  />
                )}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "text-[12px]",
                  day.isToday
                    ? "font-semibold text-fg"
                    : "font-medium text-fg-muted",
                )}
              >
                {day.initial}
              </span>
              <span className="sr-only">
                {`${day.name}${day.isToday ? " (hoy)" : ""}: ${day.studied ? "con repasos" : "sin repasos"}`}
              </span>
            </li>
          );
        })}
      </ol>

      {milestone && (
        <p className="-mt-0.5 text-[12px] text-warning-700">{milestone}</p>
      )}
    </div>
  );
}
