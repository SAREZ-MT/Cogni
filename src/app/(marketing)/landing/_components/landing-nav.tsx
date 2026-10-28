"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#tecnicas", label: "Técnicas" },
  { href: "#ciencia", label: "Ciencia" },
  { href: "#preguntas", label: "Preguntas" },
] as const;

const SOLID_AFTER = 24;
const HIDE_AFTER = 80;

// Plain near-black bar with a hairline bottom border: wordmark, four
// in-page links, one action. It turns solid after a little scroll, slides away while reading down and comes back on the way
// up (or as soon as it receives keyboard focus).
export function LandingNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setSolid(y > SOLID_AFTER);
    setHidden(y > HIDE_AFTER && y > previous);
  });

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50"
      initial={false}
      animate={{ transform: hidden ? "translateY(-100%)" : "translateY(0%)" }}
      transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
      onFocusCapture={() => setHidden(false)}
    >
      <nav
        aria-label="Principal"
        className={`border-white/[0.08] border-b transition-[background-color] duration-200 ${
          solid ? "bg-(--lp-night)/80 backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 md:px-10 xl:px-20">
          <Link
            href="/landing"
            className="rounded-md font-extrabold text-(--lp-night-ink) text-[24px] tracking-[-0.03em]"
          >
            cogni
          </Link>
          <ul className="hidden items-center gap-9 lg:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-md font-medium text-(--lp-night-ink-2) text-[14px] transition-colors duration-150 hover:text-(--lp-night-ink)"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="hidden rounded-md font-medium text-(--lp-night-ink) text-[14px] sm:inline"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="lp-press lp-cta-primary rounded-full px-4 py-2 font-bold text-[14px]"
            >
              Empieza gratis
            </Link>
          </div>
        </div>
      </nav>
    </motion.header>
  );
}
