// The browser's IANA zone, or undefined when Intl does not expose one (or
// throws). Shared by the first-use detection and the settings form so both
// agree on what "the browser's zone" is.
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
