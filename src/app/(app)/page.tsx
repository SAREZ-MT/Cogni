import { Clock, FileText, NotebookPen, PenLine } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { CreateNotebookTrigger, getHomeOverview } from "@/modules/notebooks";
import { displayNameFromEmail } from "./_components/account-name";
import { SetBreadcrumb } from "./_components/breadcrumb";
import { formatTimeAgo } from "./_components/format";
import { HomeHeader } from "./_components/home/home-header";
import { NotebookGrid } from "./_components/home/notebook-grid";
import { RecentPages } from "./_components/home/recent-pages";
import { StatCard } from "./_components/home/stat-card";

// Home shows only real data: no flashcard/streak placeholders, no invented
// numbers (odd/tasks/app-shell-restyle.md S4, Product decision 1).
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

  const weeklyProgress =
    overview.pageCount > 0
      ? (overview.pagesEditedThisWeek / overview.pageCount) * 100
      : undefined;

  return (
    <section className="flex flex-1 flex-col gap-7">
      <SetBreadcrumb items={[{ label: "Inicio" }]} />
      <HomeHeader displayName={displayName} now={now} />

      <div className="flex gap-3.5">
        <StatCard
          label="Cuadernos"
          icon={<NotebookPen aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-pastel-purple text-pastel-purple-fg"
          value={overview.notebookCount}
        />
        <StatCard
          label="Páginas"
          icon={<FileText aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-pastel-blue text-pastel-blue-fg"
          value={overview.pageCount}
        />
        <StatCard
          label="Editadas esta semana"
          icon={<PenLine aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-pastel-green text-pastel-green-fg"
          value={overview.pagesEditedThisWeek}
          hint={`de ${overview.pageCount} páginas`}
          progress={weeklyProgress}
        />
        <StatCard
          label="Última actividad"
          icon={<Clock aria-hidden="true" size={14} strokeWidth={2} />}
          iconBgClass="bg-pastel-orange text-pastel-orange-fg"
          value={
            overview.lastActivityAt
              ? formatTimeAgo(overview.lastActivityAt, now)
              : "Sin actividad"
          }
        />
      </div>

      <div>
        <h2 className="mb-3.5 font-semibold text-fg text-base">
          Mis cuadernos
        </h2>
        <NotebookGrid notebooks={overview.notebooks} now={now} />
      </div>

      <RecentPages pages={overview.recentPages} now={now} />
    </section>
  );
}
