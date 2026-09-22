import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Requirement "Anclaje del proxy matcher a rutas de aplicación"
// (specs/observability-and-delivery/spec.md), scenarios "Ruta de
// observabilidad excluida" and "Ruta con prefijo similar no excluida".
//
// `config.matcher` is a build-time-only string: Next.js never re-exports a
// compiled RegExp from it. To evaluate it "the way Next does", this test
// compiles the exact matcher source with Next's own bundled path-to-regexp
// (the same module `next/dist/lib/try-to-parse-path.js` uses internally),
// then runs it exactly like `getMiddlewareRouteMatcher`
// (`next/dist/shared/lib/router/utils/middleware-route-matcher.js`) does at
// request time: `new RegExp(matcher.regexp).exec(pathname)`.
const nextRequire = createRequire(require.resolve("next/package.json"));
const { parse, tokensToRegexp } = nextRequire(
  "next/dist/compiled/path-to-regexp",
) as {
  parse: (source: string) => unknown;
  tokensToRegexp: (tokens: unknown) => RegExp;
};

function compileMatcher(source: string): RegExp {
  const regexStr = tokensToRegexp(parse(source)).source;
  return new RegExp(regexStr);
}

// A route the proxy processes (i.e. is NOT excluded) means the matcher
// regex matches the pathname — see middleware-route-matcher.js above.
function isProcessedByProxy(regex: RegExp, pathname: string): boolean {
  return regex.test(pathname);
}

describe("proxy matcher", () => {
  it("excludes /monitoring and /monitoring/algo (observability tunnel)", async () => {
    const { config } = await import("@/proxy");
    const [source] = config.matcher;
    const regex = compileMatcher(source);

    expect(isProcessedByProxy(regex, "/monitoring")).toBe(false);
    expect(isProcessedByProxy(regex, "/monitoring/algo")).toBe(false);
  });

  it("does NOT exclude /monitoring-extra (shared prefix, different route)", async () => {
    const { config } = await import("@/proxy");
    const [source] = config.matcher;
    const regex = compileMatcher(source);

    expect(isProcessedByProxy(regex, "/monitoring-extra")).toBe(true);
  });
});
