import Link from "next/link";
import type { ComponentProps } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkLegalHeadings, remarkPendingMarks } from "../_lib/legal-remark";

// Safe renderer for the legal markdown: raw HTML is skipped (never parsed
// into the page) and react-markdown's default URL transform drops unsafe
// protocols. Styling goes through the design tokens only.

function LegalLink({ href, children }: ComponentProps<"a">) {
  if (href?.startsWith("/")) {
    return (
      <Link
        href={href}
        className="font-medium text-fg-active underline decoration-primary-300 underline-offset-2 hover:decoration-primary-600"
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-fg-active underline decoration-primary-300 underline-offset-2 hover:decoration-primary-600"
    >
      {children}
    </a>
  );
}

const HEADING_SCROLL = "scroll-mt-24";

const COMPONENTS: Components = {
  h2: ({ node: _node, ...props }) => (
    <h2
      {...props}
      className={`${HEADING_SCROLL} mt-12 mb-3 font-semibold text-fg text-xl first:mt-0`}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3
      {...props}
      className={`${HEADING_SCROLL} mt-8 mb-2 font-semibold text-base text-fg`}
    />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4
      {...props}
      className={`${HEADING_SCROLL} mt-6 mb-2 font-semibold text-fg text-sm`}
    />
  ),
  p: ({ node: _node, ...props }) => (
    <p {...props} className="my-3 text-fg-secondary leading-7" />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul
      {...props}
      className="my-3 list-disc space-y-1.5 pl-5 text-fg-secondary leading-7 marker:text-fg-muted"
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      {...props}
      className="my-3 list-decimal space-y-1.5 pl-5 text-fg-secondary leading-7 marker:text-fg-muted"
    />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong {...props} className="font-semibold text-fg" />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      {...props}
      className="my-6 rounded-xl border border-primary-100 bg-primary-50/60 px-5 py-1 [&_p]:text-fg [&_li]:text-fg"
    />
  ),
  a: ({ node: _node, ...props }) => <LegalLink {...props} />,
  table: ({ node: _node, ...props }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-border-subtle">
      <table {...props} className="w-full border-collapse text-left text-sm" />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      {...props}
      className="border-border-subtle border-b bg-neutral-50 px-3 py-2 align-top font-semibold text-fg"
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td
      {...props}
      className="border-border-subtle border-b px-3 py-2 align-top text-fg-secondary"
    />
  ),
  mark: ({ node: _node, ...props }) => (
    <mark
      {...props}
      className="rounded-sm bg-warning-100 px-1 py-0.5 font-medium text-warning-700"
    />
  ),
};

export function LegalMarkdownView({
  markdown,
  anchor,
}: {
  markdown: string;
  anchor?: string;
}) {
  return (
    <Markdown
      skipHtml
      remarkPlugins={[
        remarkGfm,
        remarkLegalHeadings({ anchor }),
        remarkPendingMarks,
      ]}
      components={COMPONENTS}
    >
      {markdown}
    </Markdown>
  );
}
