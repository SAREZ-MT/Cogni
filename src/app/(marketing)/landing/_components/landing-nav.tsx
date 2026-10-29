"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type NavTheme,
  navProbeMargin,
  readNavTheme,
  resolveNavTheme,
} from "./nav-theme";

// Written with the path so the same nav works on /ciencia, /creditos and
// the legal pages; on the landing (/) the browser keeps it an in-page jump.
export const NAV_LINKS = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#tecnicas", label: "Técnicas" },
  { href: "/#pilares", label: "Pilares" },
  { href: "/#comparacion", label: "Comparación" },
  { href: "/#preguntas", label: "Preguntas" },
] as const;

const SOLID_AFTER = 24;
// Middle of the 64px bar: the theme follows what sits under this line.
const PROBE_Y = 32;

// Plain bar fixed at the top at all times: wordmark, five in-page links,
// one action. A signed-in user (/ciencia, /creditos) gets only "Ir a la app"
// instead: the section links point at the landing, which the proxy sends a
// signed-in user away from. It is transparent over the very top of the hero and turns
// into a translucent surface after a little scroll. Its colour scheme
// follows the section under it (data-nav-theme), light-on-dark over the
// night scenes and dark-on-light over the paper ones; the colours cross-fade
// in CSS (.lp-nav), instantly under reduced motion.
export function LandingNav({ signedIn = false }: { signedIn?: boolean }) {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [theme, setTheme] = useState<NavTheme>("dark");

  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > SOLID_AFTER));

  useEffect(() => {
    setSolid(window.scrollY > SOLID_AFTER);
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-nav-theme]"),
    );
    if (sections.length === 0) return;
    const order = new Map(sections.map((el, index) => [el, index]));
    const crossing = new Set<HTMLElement>();
    let observer: IntersectionObserver | null = null;

    const update = () =>
      setTheme((previous) =>
        resolveNavTheme(
          Array.from(crossing, (el) => ({
            theme: readNavTheme(el.dataset.navTheme) ?? previous,
            order: order.get(el) ?? 0,
          })),
          previous,
        ),
      );

    // The probe margin is in pixels, so it is rebuilt when the viewport
    // height changes.
    const observe = () => {
      observer?.disconnect();
      crossing.clear();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            if (entry.isIntersecting) crossing.add(el);
            else crossing.delete(el);
          }
          update();
        },
        { rootMargin: navProbeMargin(window.innerHeight, PROBE_Y) },
      );
      for (const el of sections) observer.observe(el);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      observer?.disconnect();
    };
  }, []);

  return (
    <header
      className="lp-nav fixed inset-x-0 top-0 z-50"
      data-theme={theme}
      data-solid={solid ? "" : undefined}
    >
      <nav aria-label="Principal" className="lp-nav-bar border-b">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 md:px-10 xl:px-20">
          <Link
            href={signedIn ? "/inicio" : "/"}
            className="lp-nav-ink flex items-center gap-2 rounded-md font-extrabold text-[24px] tracking-[-0.03em]"
          >
            <NavMark />
            cogni
          </Link>
          {signedIn ? (
            <Link
              href="/inicio"
              className="lp-press lp-cta-primary rounded-full px-4 py-2 font-bold text-[14px]"
            >
              Ir a la app
            </Link>
          ) : (
            <>
              <ul className="hidden items-center gap-9 lg:flex">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="lp-nav-link rounded-md font-medium text-[14px]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-5">
                <Link
                  href="/login"
                  className="lp-nav-ink hidden rounded-md font-medium text-[14px] sm:inline"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="lp-press lp-cta-primary rounded-full px-4 py-2 font-bold text-[14px]"
                >
                  Empieza ya
                </Link>
              </div>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// The 7 v2 Glass mark, 17% larger than the 24px wordmark (28px). Both
// glass builds are stacked and cross-faded with the nav theme (.lp-nav-mark
// in landing.css): ink glass over the night scenes, paper glass over paper.
function NavMark() {
  return (
    <span aria-hidden="true" className="lp-nav-mark relative size-7 shrink-0">
      <Image
        src="/brand/cogni-mark-ink.svg"
        alt=""
        width={28}
        height={28}
        unoptimized
        data-mark="ink"
        className="absolute inset-0"
      />
      <Image
        src="/brand/cogni-mark.svg"
        alt=""
        width={28}
        height={28}
        unoptimized
        data-mark="paper"
        className="absolute inset-0"
      />
    </span>
  );
}
