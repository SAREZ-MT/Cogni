import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 flex h-(--topbar-height) shrink-0 items-center justify-between border-border-subtle border-b bg-glass px-6 backdrop-blur-md">
      <p className="text-fg-secondary text-sm">Inicio</p>
      <UserMenu />
    </header>
  );
}
