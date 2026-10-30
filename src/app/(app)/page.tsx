import * as Sentry from "@sentry/nextjs";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  addDays,
  dayKeyFormatter,
  getDashboardTechniqueMetrics,
  getHomeWeakTopics,
} from "@/modules/analytics";
import { getCurrentTimeZoneSetting, getCurrentUser } from "@/modules/identity";
import { getHomeOverview } from "@/modules/notebooks";
import {
  getDueToday,
  getTechniqueOverview,
  type TechniqueOverview,
} from "@/modules/scheduling";
import { RevealGroup, RevealItem } from "@/shared/ui/reveal";
import { displayNameFromEmail } from "./_components/account-name";
import { SetBreadcrumb } from "./_components/breadcrumb";
import { ContinueReading } from "./_components/home/continue-reading";
import { longDateLabel } from "./_components/home/home-copy";
import { HomeEmptyState } from "./_components/home/home-empty-state";
import { HomeHero, type HomeStreak } from "./_components/home/home-hero";
import { ReviewToday } from "./_components/home/review-today";
import { streakWeekDays } from "./_components/home/streak-week-days";
import { TechniqueCounts } from "./_components/home/technique-counts";
import { WeakTopics } from "./_components/home/weak-topics";
import { toReviewRows } from "./calendario/_lib/today-rows";

type DueTodayResult = Awaited<ReturnType<typeof getDueToday>>;

// The due read feeds the "Para repasar hoy" rows, so a thrown rejection
// (not only the typed { ok: false }) degrades just those instead of
// failing Home. Reviews are due per local day: everything due during the day of
// `now` in the profile's zone counts, the same bound the practice
// sessions use. Next.js control-flow errors (redirect, notFound) are
// rethrown to the framework first.
async function readDueToday(
  timeZone: string,
  now: Date,
): Promise<DueTodayResult | null> {
  try {
    return await getDueToday({ timeZone, now });
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return null;
  }
}

// The analytics review metrics of the last 7 local days (today included)
// in the profile's zone, like /dashboard: the hero's streak. The technique
// cards no longer count individual reviews (H2-T5i): they read study units
// from the technique overview.
async function readReviewMetrics(
  timeZone: string,
  now: Date,
): Promise<{ streak: HomeStreak } | null> {
  const today = dayKeyFormatter(timeZone)(now);
  const metrics = await getDashboardTechniqueMetrics({
    fromDay: addDays(today, -6),
    toDay: addDays(today, 1),
    timeZone,
    now,
  });
  if (!metrics.ok) return null;
  return {
    streak: {
      streakDays: metrics.value.overall.streakDays,
      days: streakWeekDays(metrics.value.daily, metrics.value.today),
    },
  };
}

// Per technique: today's study units (pages pending and pages done, the
// cards' progress), live item totals and the next due date (the "never
// generated" and "next review" states). Optional: a typed failure or a
// thrown rejection degrades only the cards.
async function readTechniqueOverview(
  timeZone: string,
  now: Date,
): Promise<TechniqueOverview | null> {
  try {
    const result = await getTechniqueOverview({ timeZone, now });
    return result.ok ? result.value : null;
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return null;
  }
}

// Populated Home (Phase 8 H2-T5, layout H2-T5j user decision 2026-10-18):
// the hero with the review streak full width, then a main column — today's
// progress per technique, "Continúa donde lo dejaste" (recent pages) and
// "Temas débiles" — and "Para repasar hoy" in a 320px right column that
// starts at the cards' top. Below lg everything stacks in DOM order, so
// today's work comes first: cards, reviews, recent pages, weak topics.
// Without notebooks it shows the first-run empty state (H2-T3).
export default async function HomePage() {
  // The user is read first (and redirected on, same as layout.tsx) before
  // touching the owner-scoped reads: running them in parallel let a session
  // that disappeared mid-request (e.g. sign-out) reach requireOwnerId()
  // and throw "Debes iniciar sesión para continuar." instead of a clean
  // redirect to /login.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
    return;
  }
  const [overview, timeZoneSetting] = await Promise.all([
    getHomeOverview(),
    getCurrentTimeZoneSetting(),
  ]);

  if (overview.notebookCount === 0) {
    return (
      <>
        <SetBreadcrumb items={[{ label: "Inicio" }]} />
        <HomeEmptyState />
      </>
    );
  }

  // One instant for every read, so "today" agrees across the page.
  const now = new Date();
  const { timeZone } = timeZoneSetting;
  const [dueResult, reviewMetrics, techniqueOverview, weakTopics] =
    await Promise.all([
      readDueToday(timeZone, now),
      readReviewMetrics(timeZone, now),
      readTechniqueOverview(timeZone, now),
      getHomeWeakTopics({ now }),
    ]);
  const duePages = dueResult?.ok ? dueResult.value : null;

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb items={[{ label: "Inicio" }]} />
      {/* One quiet entrance: the blocks rise in, top to bottom (≤0.5s,
          instant under reduced motion). */}
      <RevealGroup className="flex flex-col gap-7">
        <RevealItem>
          <HomeHero
            displayName={displayNameFromEmail(user.email)}
            dateLabel={longDateLabel(now, timeZone)}
            streak={reviewMetrics?.streak ?? null}
          />
        </RevealItem>
        {/* lg: the right column spans the three left rows and is sized by
            them only (its card is absolutely positioned and scrolls), so it
            ends exactly where Temas débiles ends (user 2026-10-18). */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RevealItem className="min-w-0 lg:col-start-1 lg:row-start-1">
            <TechniqueCounts
              overview={techniqueOverview}
              timeZone={timeZone}
              now={now}
            />
          </RevealItem>
          <RevealItem className="min-w-0 relative lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <ReviewToday rows={duePages ? toReviewRows(duePages) : null} />
          </RevealItem>
          <RevealItem className="min-w-0 lg:col-start-1 lg:row-start-2">
            <ContinueReading pages={overview.recentPages} now={now} />
          </RevealItem>
          <RevealItem className="min-w-0 lg:col-start-1 lg:row-start-3">
            <WeakTopics topics={weakTopics.ok ? weakTopics.value : null} />
          </RevealItem>
        </div>
      </RevealGroup>
    </section>
  );
}
