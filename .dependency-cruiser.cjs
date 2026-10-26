/** @type {import('dependency-cruiser').IConfiguration} */
// Encodes documento-maestro.md §5.3 (dependency rules) as CI-enforced errors.
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment:
        "domain must not import from other layers or other modules; only shared/kernel is allowed.",
      severity: "error",
      // Domain tests may import the test runner; production code may not.
      from: { path: "^src/modules/[^/]+/domain", pathNot: "\\.test\\.ts$" },
      to: {
        pathNot: "^(src/modules/[^/]+/domain|src/shared/kernel)",
      },
    },
    {
      name: "domain-no-npm",
      comment:
        "domain must not depend on external npm packages (Next.js, Drizzle, AI SDK, React, etc). Zod is the only allowed exception.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain", pathNot: "\\.test\\.ts$" },
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
        "a module may only be imported through its public index.ts, never through internal paths. The one other public entry is a domain-only calibration.ts (active-recall), kept pure by domain-entry-is-pure.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/[^/]+/.+",
        pathNot:
          "^(src/modules/$1/|src/modules/[^/]+/(index|calibration)\\.ts$)",
      },
    },
    {
      name: "domain-entry-is-pure",
      comment:
        "a domain-only public entry (calibration.ts at a module root) may only re-export its own domain or shared/kernel, so importing it never loads Server Actions, infrastructure or ui.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/calibration\\.ts$" },
      to: {
        pathNot: "^(src/modules/$1/domain/|src/shared/kernel/)",
      },
    },
    {
      name: "proxy-via-public-entry",
      comment:
        "src/proxy.ts (the per-request Next.js proxy) may only import a module through a public entry: its index.ts or a light proxy.ts entry that avoids the index's server-only graph (identity/proxy.ts).",
      severity: "error",
      from: { path: "^src/proxy\\.ts$" },
      to: {
        path: "^src/modules/",
        pathNot: "^src/modules/[^/]+/(index|proxy)\\.ts$",
      },
    },
    {
      name: "editor-tiptap-only-in-ui",
      comment:
        "Tiptap and ProseMirror packages may only be imported from editor/ui; editor/domain and editor/application must stay framework-agnostic.",
      severity: "error",
      from: { path: "^src/modules/editor/(?!ui/)", pathNot: "\\.test\\.ts$" },
      to: { path: "^(node_modules/)?(@tiptap|prosemirror-)" },
    },
    {
      name: "study-engine-knows-no-technique",
      comment:
        "study-engine is technique-agnostic; flashcards, exams and active-recall must talk to it through its ports, never the reverse.",
      severity: "error",
      from: { path: "^src/modules/study-engine/" },
      to: { path: "^src/modules/(flashcards|exams|active-recall)/" },
    },
    {
      name: "unpdf-only-in-ingestion-infra",
      comment:
        "unpdf may only be imported from ingestion/infrastructure (pdf-document-extractor.ts, until document-import T8 removes it); every other layer and module must stay decoupled from the PDF parsing library. Unanchored (not `^node_modules/unpdf`): pnpm resolves it to a nested node_modules/.pnpm/unpdf@.../node_modules/unpdf/... path.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/modules/ingestion/infrastructure/",
      },
      to: { path: "node_modules/unpdf" },
    },
    {
      name: "ai-sdk-only-in-ai-infra",
      comment:
        "The AI SDK and its provider packages may only be imported from ai/infrastructure (documento-maestro §8.1); every other layer and module goes through ai.application. Unanchored for the same pnpm nested node_modules reason as unpdf.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/modules/ai/infrastructure/",
      },
      to: { path: "node_modules/(ai|@ai-sdk/[^/]+|@openrouter/[^/]+)/" },
    },
    {
      name: "upstash-only-in-ai-infra",
      comment:
        "Upstash packages may only be imported from ai/infrastructure; domain and application depend on ports.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/modules/ai/infrastructure/",
      },
      to: { path: "node_modules/@upstash/" },
    },
  ],
  options: {
    // Type-only imports (`import type`) are erased by tsc, but they are still
    // architectural dependencies: without this flag a domain file could
    // import a type from another module and no rule would see it.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
