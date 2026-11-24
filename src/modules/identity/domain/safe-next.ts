// Guards a `next` target (auth callback, terms gate) against open
// redirects. The candidate is resolved the way a browser would, against a
// placeholder origin, and only passes when it stays on that origin: a plain
// prefix check misses forms a browser normalises, such as "/<tab>/host"
// (tabs and line breaks are dropped, leaving the protocol-relative
// "//host"). Anything else falls back to Inicio, the app home (the domain
// root is the public landing).
const FALLBACK = "/inicio";
const PLACEHOLDER_ORIGIN = "http://next.invalid";

export function safeNext(candidate: string | null | undefined): string {
  if (!candidate?.startsWith("/")) return FALLBACK;
  let url: URL;
  try {
    url = new URL(candidate, PLACEHOLDER_ORIGIN);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return FALLBACK;
  return `${url.pathname}${url.search}${url.hash}`;
}
