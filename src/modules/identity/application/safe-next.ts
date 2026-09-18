// Guards the `next` parameter of the auth callback against open redirects.
// Only same-origin absolute paths pass; "//host", "/\host" and any scheme
// fall back to the root.
export function safeNext(candidate: string | null | undefined): string {
  if (!candidate) return "/";
  if (!candidate.startsWith("/")) return "/";
  const second = candidate.charAt(1);
  if (second === "/" || second === "\\") return "/";
  return candidate;
}
