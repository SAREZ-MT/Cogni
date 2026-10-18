import Image from "next/image";
import { StreakWeek, type StreakWeekDay } from "@/shared/ui/streak-week";
import { streakHelper } from "./home-copy";

export interface HomeStreak {
  streakDays: number;
  days: StreakWeekDay[];
}

export interface HomeHeroProps {
  displayName: string;
  // "Sábado 18 de octubre", in the profile's zone.
  dateLabel: string;
  // null when the analytics read failed: the hero still greets.
  streak: HomeStreak | null;
}

// Populated Home hero (Phase 8 H2-T5b, reference "Welcome back" card): the
// greeting with today's date and a short line about learning, the
// review-based day streak under them, and the illustration on the right
// (no graph paper behind it: user 2026-10-18). The surface carries soft violet and pink glows (globals.css home-hero-glow);
// the illustration hides on narrow widths so the text never gets squeezed.
export function HomeHero({ displayName, dateLabel, streak }: HomeHeroProps) {
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative flex items-stretch gap-6 overflow-hidden rounded-xl border border-border-subtle bg-card shadow-xs home-hero-glow"
    >
      <div className="relative flex min-w-0 flex-1 flex-col gap-6 py-7 pr-8 pl-8 lg:pr-0">
        <div className="flex flex-col gap-2">
          <h1
            id="home-hero-title"
            className="text-balance font-semibold text-[30px] text-fg leading-[1.15] tracking-[-0.02em]"
          >
            Hola de nuevo, {displayName}
          </h1>
          <p className="font-medium text-[15px] text-fg">{dateLabel}</p>
          <p className="text-[15px] text-fg-secondary">
            Cada repaso y sesión de estudio que haces hoy te ayudan a mejorar tu
            aprendizaje.
          </p>
        </div>
        <div className="mt-auto">
          {streak ? (
            <StreakWeek
              streakDays={streak.streakDays}
              days={streak.days}
              helper={streakHelper(streak.streakDays, streak.days)}
            />
          ) : (
            <p className="text-[13px] text-fg-muted">
              No pudimos cargar tu racha.
            </p>
          )}
        </div>
      </div>
      <div className="relative hidden w-[340px] shrink-0 items-center justify-center lg:flex xl:w-[400px]">
        <Image
          src="/illustrations/home-welcome.webp"
          alt=""
          width={720}
          height={736}
          sizes="280px"
          priority
          className="relative h-auto w-[240px] mix-blend-multiply xl:w-[280px]"
        />
      </div>
    </section>
  );
}
