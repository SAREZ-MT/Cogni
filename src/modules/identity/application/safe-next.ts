// Guards the `next` parameter of the auth callback against open redirects.
// Only same-origin absolute paths pass; "//host", "/\host" and any scheme
// fall back to Inicio, the app home (the domain root is the public landing).
const FALLBACK = "/inicio";

export function safeNext(candidate: string | null | undefined): string {
  if (!candidate) return FALLBACK;
  if (!candidate.startsWith("/")) return FALLBACK;
  const second = candidate.charAt(1);
  if (second === "/" || second === "\\") return FALLBACK;
  return candidate;
}
