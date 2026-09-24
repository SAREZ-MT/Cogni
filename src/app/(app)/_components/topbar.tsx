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
      <UserMenu user={user} />
    </header>
  );
}
