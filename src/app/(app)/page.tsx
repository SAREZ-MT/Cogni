import * as Sentry from "@sentry/nextjs";
import {
  BookOpenCheck,
  Flame,
  Layers,
  NotebookPen,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { CreateNotebookTrigger, getHomeOverview } from "@/modules/notebooks";
import { listDueTodayAction, totalDueCount } from "@/modules/scheduling";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionTitle } from "@/shared/ui/section-header";
import { displayNameFromEmail } from "./_components/account-name";
import { SetBreadcrumb } from "./_components/breadcrumb";
import { HomeHeader } from "./_components/home/home-header";
import { NotebookGrid } from "./_components/home/notebook-grid";
import { ReadyToReview } from "./_components/home/ready-to-review";
import { RecentPages } from "./_components/home/recent-pages";
import { StatCard } from "./_components/home/stat-card";
import { StreakDots } from "./_components/home/streak-dots";
import { WeakTopics } from "./_components/home/weak-topics";

type DueTodayResult = Awaited<ReturnType<typeof listDueTodayAction>>;

// The due read feeds a single card, so a thrown rejection (not only the
// typed { ok: false }) degrades just that card instead of failing Home.
// Next.js control-flow errors (redirect, notFound) are rethrown to the
// framework first.
async function readDueToday(): Promise<DueTodayResult | null> {
  try {
    return await listDueTodayAction();
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return null;
  }
}

// "Repasos pendientes hoy" card copy: the real total due now across the
// three techniques (scheduling's listDueToday, Phase 7 T1), or an explicit
// failure instead of a false zero.
function dueTodayStat(dueResult: DueTodayResult | null) {
  if (!dueResult?.ok) {
    return { value: "—", unit: null, hint: "No pudimos cargar tus repasos" };
  }
  const total = totalDueCount(dueResult.value);
  const pages = dueResult.value.length;
  return {
    value: String(total),
    unit: total === 1 ? "repaso" : "repasos",
    hint:
      total === 0
        ? "Estás al día"
        : `en ${pages} ${pages === 1 ? "página" : "páginas"}`,
  };
}

// Design pass 2 (odd/tasks, Home study-metrics decisions): Home shows real
// study-progress metrics derived from page activity (readyToReview, streak,
// weeklyGoal — all from getHomeOverview) and, since Phase 7 T1, the real
// count of reviews due today, linking to the calendar's "Hoy" tab.
export default async function HomePage() {
  // The user is read first (and redirected on, same as layout.tsx) before
  // touching getHomeOverview: running both in Promise.all let a session
  // that disappeared mid-request (e.g. sign-out) reach requireOwnerId()
  // and throw "Debes iniciar sesión para continuar." instead of a clean
  // redirect to /login.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
    return;
  }
  const [overview, dueResult] = await Promise.all([
    getHomeOverview(),
    readDueToday(),
  ]);
  const displayName = displayNameFromEmail(user.email);
  const now = new Date();

  if (overview.notebookCount === 0) {
    return (
      <>
        <SetBreadcrumb items={[{ label: "Inicio" }]} />
        <EmptyState
          as="section"
          variant="plain"
          fill
          icon={
            <IconTile size="56" radius="xl" tone="purple">
              <NotebookPen aria-hidden="true" size={28} strokeWidth={1.5} />
            </IconTile>
          }
          title="Tu espacio de estudio"
          titleAs="h1"
          titleClassName="text-xl"
          description="Aún no tienes cuadernos. Crea uno para empezar."
          descriptionClassName="max-w-sm text-fg-secondary"
          action={<CreateNotebookTrigger variant="pill" />}
        />
      </>
    );
  }

  const topReady = overview.readyToReview.items[0];
  const readyProgress =
    overview.readyToReview.totalRich > 0
      ? (overview.readyToReview.totalReady / overview.readyToReview.totalRich) *
        100
      : undefined;
  const streakProgress = (overview.streak.activeDays / 14) * 100;
  const dueStat = dueTodayStat(dueResult);
  const weeklyProgress =
    (overview.weeklyGoal.activeDays / overview.weeklyGoal.goal) * 100;

  return (
    <section className="flex flex-1 flex-col gap-7">
      <SetBreadcrumb items={[{ label: "Inicio" }]} />
      <HomeHeader displayName={displayName} now={now} />

      <div className="flex gap-3.5">
        <StatCard
          label="Notas listas para repasar"
          icon={<BookOpenCheck aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-primary-100 text-primary-600"
          value={overview.readyToReview.totalReady}
          hint={
            topReady
              ? `la más urgente: ${topReady.title}`
              : "Ninguna nota lista todavía"
          }
          progress={readyProgress}
          action={
            topReady && (
              <Link
                href={`/notebooks/${topReady.notebookId}/pages/${topReady.id}`}
                className="font-medium text-[11.5px] text-primary-600 hover:underline"
              >
                Repasar →
              </Link>
            )
          }
        />
        <StatCard
          label="Índice de constancia"
          icon={<Flame aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-pastel-green text-success-600"
          value={`${overview.streak.activeDays}/14 días`}
          hint="constancia en dos semanas"
          progress={streakProgress}
          progressClassName={
            streakProgress >= 50 ? "gradient-streak" : undefined
          }
          footer={<StreakDots days={overview.streak.days} />}
        />
        <StatCard
          label="Meta semanal de estudio"
          icon={<Target aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-pastel-yellow text-warning-600"
          value={
            <>
              {overview.weeklyGoal.activeDays}/{overview.weeklyGoal.goal}{" "}
              <span className="font-normal text-[13px] text-fg-muted">
                días
              </span>
            </>
          }
          hint={`meta: ${overview.weeklyGoal.goal} días por semana`}
          progress={weeklyProgress}
          action={
            <button
              type="button"
              disabled
              title="pronto"
              className="font-medium text-[11.5px] text-fg-muted disabled:cursor-not-allowed"
            >
              Ajustar
            </button>
          }
        />
        <div data-testid="due-today-stat" className="flex flex-1">
          <StatCard
            label="Repasos pendientes hoy"
            icon={<Layers aria-hidden="true" size={14} strokeWidth={2} />}
            iconBgClass="bg-error-100 text-error-500"
            value={
              <>
                {dueStat.value}
                {dueStat.unit && (
                  <>
                    {" "}
                    <span className="font-normal text-[13px] text-fg-muted">
                      {dueStat.unit}
                    </span>
                  </>
                )}
              </>
            }
            hint={dueStat.hint}
            action={
              <Link
                href="/calendario"
                className="font-medium text-[11.5px] text-primary-600 hover:underline"
              >
                Ver calendario →
              </Link>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <ReadyToReview readyToReview={overview.readyToReview} now={now} />
        <WeakTopics />
      </div>

      <div>
        <SectionTitle
          action={
            <Link
              href="/notebooks"
              className="font-medium text-[13px] text-primary-600 hover:underline"
            >
              Ver todos →
            </Link>
          }
        >
          Mis cuadernos
        </SectionTitle>
        <NotebookGrid notebooks={overview.notebooks.slice(0, 6)} now={now} />
      </div>

      <RecentPages pages={overview.recentPages} now={now} />
    </section>
  );
}
