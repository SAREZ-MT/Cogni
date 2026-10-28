import { FileWarning } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import {
  LEGAL_DRAFT_NOTICE,
  LEGAL_PAGES,
  type LegalPageSlug,
} from "../_lib/legal-documents";
import { buildLegalPage, splitPending } from "../_lib/legal-markdown";
import { LegalMarkdownView } from "./legal-markdown-view";

function WithPendingMarks({ text }: { text: string }) {
  return (
    <>
      {splitPending(text).map((chunk, position) =>
        chunk.pending ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: static text runs
            key={position}
            data-pending="true"
            className="rounded-sm bg-warning-100 px-1 py-0.5 font-medium text-warning-700"
          >
            {chunk.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text runs
          <span key={position}>{chunk.text}</span>
        ),
      )}
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 font-semibold text-[11px] text-fg-muted uppercase tracking-wider">
      {children}
    </p>
  );
}

export async function LegalPage({ slug }: { slug: LegalPageSlug }) {
  // The CSP nonce is applied only while rendering a request
  // (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
  // "Forcing dynamic rendering").
  await connection();
  const page = buildLegalPage(slug);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-12">
      <aside className="lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto">
        <nav aria-label="En esta página" className="text-sm">
          <SectionLabel>En esta página</SectionLabel>
          <ol className="flex flex-col gap-0.5 border-border-subtle border-l">
            {page.index.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="-ml-px block border-transparent border-l-2 py-1 pl-3 text-fg-secondary leading-snug no-underline transition-colors hover:border-primary-400 hover:text-fg"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <nav aria-label="Documentos legales" className="mt-8 text-sm">
          <SectionLabel>Documentos legales</SectionLabel>
          <ul className="flex flex-col gap-0.5">
            {LEGAL_PAGES.map((other) => {
              const current = other.slug === slug;
              return (
                <li key={other.slug}>
                  <Link
                    href={other.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "block rounded-input bg-active px-3 py-1.5 font-medium text-fg-active no-underline"
                        : "block rounded-input px-3 py-1.5 text-fg-secondary no-underline transition-colors hover:bg-hover hover:text-fg"
                    }
                  >
                    {other.navLabel}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <article className="min-w-0 rounded-content bg-page px-5 py-8 shadow-card md:px-12 md:py-12">
        <div className="max-w-[68ch]">
          <header className="mb-8 flex flex-col gap-4 border-border-subtle border-b pb-8">
            <h1 className="text-balance font-semibold text-3xl text-fg leading-tight">
              {page.title}
            </h1>
            <dl className="flex flex-col gap-1 text-fg-secondary text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
              <div className="flex gap-1.5">
                <dt className="text-fg-muted">Versión</dt>
                <dd data-testid="legal-version">{page.metadata.version}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-fg-muted">Vigente desde</dt>
                <dd data-testid="legal-effective-from">
                  <WithPendingMarks text={page.metadata.effectiveFrom} />
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-fg-muted">Responsable</dt>
                <dd>
                  <WithPendingMarks text={page.metadata.responsible} />
                </dd>
              </div>
            </dl>
            <p
              role="note"
              data-testid="legal-draft-notice"
              className="flex items-start gap-2 rounded-input border border-warning-500/30 bg-warning-50 px-3 py-2 text-sm text-warning-700"
            >
              <FileWarning
                aria-hidden="true"
                size={16}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0"
              />
              {LEGAL_DRAFT_NOTICE}
            </p>
          </header>
          {page.sections.map((section) => (
            <section
              key={section.key}
              className={
                section.anchor
                  ? "mt-16 border-border-subtle border-t pt-4"
                  : undefined
              }
            >
              <LegalMarkdownView
                markdown={section.markdown}
                anchor={section.anchor}
              />
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
