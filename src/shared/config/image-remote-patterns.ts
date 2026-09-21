// design.md, "images.remotePatterns y img-src de CSP en el mismo pase":
// only the exact configured Supabase project host, scoped to the read
// signed-URL path (`getAssetReadUrl` returns URLs under
// `/storage/v1/object/sign/...`).
//
// Pure and tolerant on purpose: next.config.ts is evaluated by tooling that
// runs without the app env (the `postinstall` typegen in CI's verify job,
// `next lint`, editors), so an absent or malformed variable yields no
// pattern instead of throwing. The real build and the runtime still
// validate the variable through clientEnv() where it is actually used.
export interface ImageRemotePattern {
  protocol: "http" | "https";
  hostname: string;
  pathname: string;
}

export function supabaseImageRemotePatterns(
  supabaseUrl: string | undefined,
): ImageRemotePattern[] {
  if (!supabaseUrl) return [];
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return [];
  }
  return [
    {
      protocol: url.protocol === "http:" ? "http" : "https",
      hostname: url.hostname,
      pathname: "/storage/v1/object/sign/**",
    },
  ];
}
