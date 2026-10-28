import Link from "next/link";

type FooterLink = { href: string; label: string };

// Landing anchors are written with the path so they also work from
// /ciencia, /creditos and the legal pages.
const PRODUCT: readonly FooterLink[] = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#tecnicas", label: "Técnicas" },
  { href: "/#comparacion", label: "Comparación" },
  { href: "/#preguntas", label: "Preguntas" },
];

// The four public legal pages (feature legal-consent); each one is listed
// in the proxy OPEN_PATHS so anonymous visitors can read it.
export const LEGAL: readonly FooterLink[] = [
  { href: "/legal/terminos", label: "Términos y condiciones" },
  { href: "/legal/privacidad", label: "Política de privacidad" },
  { href: "/legal/uso-aceptable", label: "Uso aceptable" },
  { href: "/legal/derechos-de-autor", label: "Derechos de autor" },
  { href: "/creditos", label: "Créditos" },
];

// The shared close of every public page (Pencil "Landing · Contenido
// propuesto v2", Pie): the wordmark with its promise, three columns of
// links on the night ground the hero opened with, and the academic notice.
export function SiteFooter() {
  return (
    <footer
      data-nav-theme="dark"
      className="lp-footer relative -mt-px bg-(--lp-night) px-5 pt-16 pb-10 text-(--lp-night-ink-2) md:px-10 md:pt-[72px] xl:px-20"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-fit rounded-md font-(family-name:--lp-font-head) font-bold text-(--lp-night-ink) text-[28px] tracking-[-0.03em]"
            >
              cogni
            </Link>
            <p className="font-(family-name:--lp-font-display) text-[22px] italic">
              Recuerda lo que estudias.
            </p>
          </div>
          <nav
            aria-label="Pie de página"
            className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-[auto_auto_auto] sm:gap-x-16 lg:gap-x-20"
          >
            <FooterColumn title="Producto" links={PRODUCT} />
            <div className="flex flex-col gap-3">
              <h2 className="lp-footer-title">Aprende</h2>
              <Link
                href="/ciencia"
                className="lp-link w-fit rounded-sm text-(--lp-violet-300) text-[15px]"
              >
                La ciencia detrás de Cogni →
              </Link>
            </div>
            <FooterColumn title="Legal" links={LEGAL} />
          </nav>
        </div>
        <div className="lp-footer-base mt-14 flex flex-col gap-2 pt-6 text-(--lp-night-ink-3) text-[13px] sm:flex-row sm:justify-between">
          <p>
            Cogni es un proyecto académico (trabajo de grado) en desarrollo.
          </p>
          <p>© 2026 Cogni</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  className = "",
}: {
  title: string;
  links: readonly FooterLink[];
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h2 className="lp-footer-title">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="lp-link lp-footer-link rounded-sm text-[15px]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
