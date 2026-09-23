// Small, fixed set of Spanish presentation formats shared across the
// authenticated shell (ui_kits/app/Home Page.html): greeting text and
// compact relative time ("hace 2h", "ayer", "hace 3 días", "hace 1 sem").
// Moved out of home/ (S5, odd/tasks/app-shell-restyle.md) so the page
// header's "última edición" meta item can reuse formatTimeAgo too. No
// date-fns dependency: the repo has no relative-time formatting yet, and
// this set of buckets is small and fixed enough not to need one.

// Server time (Home is a Server Component with no client interactivity in
// the greeting itself); the identity module's profile timezone is not
// wired into the shell yet, so this uses the server's local hour like the
// rest of the shell's Date usage.
export function greetingForHour(hour: number, name: string): string {
  if (hour >= 5 && hour < 12) return `Buenos días, ${name}`;
  if (hour >= 12 && hour < 19) return `Buenas tardes, ${name}`;
  return `Buenas noches, ${name}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export function formatTimeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < MINUTE_MS) return "justo ahora";
  if (diffMs < HOUR_MS) return `hace ${Math.floor(diffMs / MINUTE_MS)}m`;
  if (diffMs < DAY_MS) return `hace ${Math.floor(diffMs / HOUR_MS)}h`;
  if (diffMs < 2 * DAY_MS) return "ayer";
  if (diffMs < WEEK_MS) return `hace ${Math.floor(diffMs / DAY_MS)} días`;
  if (diffMs < MONTH_MS) return `hace ${Math.floor(diffMs / WEEK_MS)} sem`;
  if (diffMs < YEAR_MS) {
    const months = Math.floor(diffMs / MONTH_MS);
    return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
  }
  const years = Math.floor(diffMs / YEAR_MS);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}
