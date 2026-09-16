/** @type {import('dependency-cruiser').IConfiguration} */
// Encodes documento-maestro.md §5.3 (dependency rules) as CI-enforced errors.
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment:
        "domain must not import from other layers or other modules; only shared/kernel is allowed.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain" },
      to: {
        pathNot: "^(src/modules/[^/]+/domain|src/shared/kernel)",
      },
    },
    {
      name: "domain-no-npm",
      comment:
        "domain must not depend on external npm packages (Next.js, Drizzle, AI SDK, React, etc). Zod is the only allowed exception.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain" },
      to: { dependencyTypes: ["npm"], pathNot: "node_modules/zod" },
    },
    {
      name: "application-no-infra-or-ui",
      comment:
        "application depends only on domain and ports; it must never import infrastructure or ui.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/application" },
      to: { path: "^src/modules/[^/]+/(infrastructure|ui)" },
    },
    {
      name: "ui-never-touches-infra",
      comment:
        "ui (and app routes) consume application through Server Actions or route handlers; they must never import infrastructure directly.",
      severity: "error",
      from: { path: "^src/(app|modules/[^/]+/ui)" },
      to: { path: "^src/modules/[^/]+/infrastructure" },
    },
    {
      name: "cross-module-via-index",
      comment:
        "a module may only be imported through its public index.ts, never through internal paths.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/[^/]+/.+",
        pathNot: "^(src/modules/$1/|src/modules/[^/]+/index\\.ts$)",
      },
    },
    {
      name: "study-engine-knows-no-technique",
      comment:
        "study-engine is technique-agnostic; flashcards, exams and active-recall must talk to it through its ports, never the reverse.",
      severity: "error",
      from: { path: "^src/modules/study-engine/" },
      to: { path: "^src/modules/(flashcards|exams|active-recall)/" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
