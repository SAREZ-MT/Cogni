import { Bell, Share2 } from "lucide-react";
import { Breadcrumb } from "./breadcrumb";
import { UserMenu } from "./user-menu";

type TopbarProps = {
  user: { id: string; email: string | null };
};

// comp-topbar.html, Engram obs 140 (topbar anatomy): 52px sticky, translucent
// white + blur, route-aware breadcrumb on the left, the account trigger on
// the right.
export function Topbar({ user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-(--topbar-height) shrink-0 items-center justify-between rounded-t-xl border-neutral-200/60 border-b bg-glass px-6 backdrop-blur-[12px]">
      <Breadcrumb />
      <div className="flex items-center gap-1">
        {/* Decorative-only, same as StudyPlatform's layout.tsx:76-105
            (studyplatform-style-report.md §4): no handler wired up yet,
            share/notifications are not a feature of this pass. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md text-fg-muted"
        >
          <Share2 aria-hidden="true" size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md text-fg-muted"
        >
          <Bell aria-hidden="true" size={15} strokeWidth={1.75} />
        </button>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
