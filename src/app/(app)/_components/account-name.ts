// Pure helpers shared by Server Components (app/(app)/page.tsx) and
// "use client" components (user-menu.tsx, sidebar-user-card.tsx). They must
// stay in a plain module: a function exported from a "use client" file
// becomes a client reference, and calling it inside a Server Component
// throws at runtime ("Attempted to call displayNameFromEmail() from the
// server but displayNameFromEmail is on the client"), which took the Home
// page down to its error boundary during the S4 verification.

// No display-name field is fetched for the shell yet (layout.tsx only calls
// getCurrentUser()), so every surface that needs a human-friendly label
// derives one from the email's local part instead of inventing one (S2
// product decision 3: the same identity everywhere).
export function displayNameFromEmail(email: string | null): string {
  if (!email) return "Cuenta";
  const local = email.split("@")[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function initialsFrom(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}
