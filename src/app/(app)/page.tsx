import {
  BookOpenCheck,
  Flame,
  Layers,
  NotebookPen,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { CreateNotebookTrigger, getHomeOverview } from "@/modules/notebooks";
import { displayNameFromEmail } from "./_components/account-name";
import { SetBreadcrumb } from "./_components/breadcrumb";
import { HomeHeader } from "./_components/home/home-header";
import { NotebookGrid } from "./_components/home/notebook-grid";
import { ReadyToReview } from "./_components/home/ready-to-review";
import { RecentPages } from "./_components/home/recent-pages";
import { StatCard } from "./_components/home/stat-card";
import { StreakDots } from "./_components/home/streak-dots";
import { WeakTopics } from "./_components/home/weak-topics";

// Design pass 2 (odd/tasks, Home study-metrics decisions): Home now shows
// real study-progress metrics derived from page activity (readyToReview,
// streak, weeklyGoal — all from getHomeOverview) plus one explicit
// placeholder ("Repasos pendientes hoy") the user asked for ahead of
// Flashcards shipping. This supersedes the earlier "no invented metrics"
// decision only for that one card, per the design-pass-2 spec.
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
  const overview = await getHomeOverview();
  const displayName = displayNameFromEmail(user.email);
  const now = new Date();

  if (overview.notebookCount === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <SetBreadcrumb items={[{ label: "Inicio" }]} />
        <span className="flex size-14 items-center justify-center rounded-xl bg-pastel-purple text-pastel-purple-fg">
          <NotebookPen aria-hidden="true" size={28} strokeWidth={1.5} />
        </span>
        <h1 className="font-semibold text-fg text-xl">Tu espacio de estudio</h1>
        <p className="max-w-sm text-fg-secondary text-sm">
          Aún no tienes cuadernos. Crea uno para empezar.
        </p>
        <CreateNotebookTrigger variant="pill" />
      </section>
    );
  }

  const topReady = overview.readyToReview.items[0];
  const readyProgress =
    overview.readyToReview.totalRich > 0
      ? (overview.readyToReview.totalReady / overview.readyToReview.totalRich) *
        100
      : undefined;
  const streakProgress = (overview.streak.activeDays / 14) * 100;
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
        <StatCard
          label="Repasos pendientes hoy"
          icon={<Layers aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-error-100 text-error-500"
          value={
            <>
              0{" "}
              <span className="font-normal text-[13px] text-fg-muted">
                tarjetas
              </span>
            </>
          }
          hint="Flashcards llegan pronto"
          action={
            <span className="rounded-pill bg-neutral-150 px-2 py-0.5 font-semibold text-[10px] text-fg-muted">
              pronto
            </span>
          }
          muted
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <ReadyToReview readyToReview={overview.readyToReview} now={now} />
        <WeakTopics />
      </div>

      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="font-semibold text-fg text-base">Mis cuadernos</h2>
          <Link
            href="/notebooks"
            className="font-medium text-[13px] text-primary-600 hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        <NotebookGrid notebooks={overview.notebooks.slice(0, 6)} now={now} />
      </div>

      <RecentPages pages={overview.recentPages} now={now} />
    </section>
  );
}
