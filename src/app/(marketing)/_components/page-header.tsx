import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// The lilac head of the public pages (Pencil "Página · La ciencia detrás de
// Cogni" and "Página · Créditos"): an optional way back to the landing, the
// mono label, one huge headline with a single serif italic keyword (passed
// in `title`), the intro line and an optional slot below it.
export function PageHeader({
  label,
  title,
  intro,
  titleId,
  back = false,
  children,
}: {
  label: string;
  title: ReactNode;
  intro: string;
  titleId: string;
  back?: boolean;
  children?: ReactNode;
}) {
  return (
    <header
      data-nav-theme="light"
      className="lp-on-paper bg-(--lp-lilac) px-5 pt-[104px] pb-16 md:px-10 md:pt-[120px] md:pb-20 xl:px-20"
    >
      <div className="mx-auto max-w-[1280px]">
        {back ? (
          <Link
            href="/"
            className="lp-link mb-8 inline-flex items-center gap-2 rounded-md font-(family-name:--lp-font-head) font-semibold text-(--lp-violet-deep) text-[14px]"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Volver a Cogni
          </Link>
        ) : null}
        <p className="flex items-center gap-3 font-(family-name:--lp-font-mono) text-(--lp-violet-deep) text-[16px] uppercase tracking-[0.14em] md:text-[20px]">
          <span
            aria-hidden="true"
            className="size-2 bg-(--lp-violet) md:size-2.5"
          />
          {label}
        </p>
        <h1 id={titleId} className="lp-headline mt-6 text-(--lp-ink) md:mt-8">
          {title}
        </h1>
        <p className="mt-6 max-w-[52ch] text-(--lp-ink-2) text-[18px] leading-[1.55] md:mt-8 md:text-[20px]">
          {intro}
        </p>
        {children}
      </div>
    </header>
  );
}
