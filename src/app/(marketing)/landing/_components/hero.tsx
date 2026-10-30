"use client";

import { ArrowRight } from "lucide-react";
import {
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { HeroNetwork } from "./hero-network-canvas";
import {
  collapsedScrollY,
  HERO_LINES,
  HERO_SENTENCE,
  latchProgress,
  outroProgress,
  PIN_SETTLE_MS,
  settleProgress,
  shouldCollapsePin,
  wordProgress,
} from "./hero-timeline";

// A pinned, scroll-scrubbed scene. The h1 is static, server-rendered text
// visible from the first paint (it is the LCP element); it only settles to
// a smaller size as the reveal begins. The sentence below sharpens word by
// word, the knowledge web grows behind it, and the subtitle and actions
// arrive when the sentence completes. Everything is a function of the
// track's scroll progress: scrolling up plays it backwards while it runs,
// but once it completes it latches (one way, until reload), and when the
// visitor scrolls past and the scroll settles, the pin collapses to one
// viewport with a same-frame scroll compensation, so scrolling back up
// never crawls through a frozen pin. Reduced motion (landing.css): no pin, every element in its final state.

const SETTLED_SCALE = 0.6;
const RISE_PX = 56;
const WORD_BLUR_PX = 9;
const WORD_DIM = 0.2;

export function Hero() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollY, scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  // The scene reads this latched value, never the raw scroll progress.
  const progress = useMotionValue(0);
  const collapsed = useRef(false);
  const lastScrollAt = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The collapse runs only once the scroll has settled (shouldCollapsePin):
  // an instant scrollTo mid-flight would cancel a smooth anchor jump.
  const collapsePin = () => {
    settleTimer.current = null;
    const track = trackRef.current;
    const stage = track?.firstElementChild;
    if (!track || !(stage instanceof HTMLElement)) return;
    const trackHeight = track.offsetHeight;
    const viewport = stage.offsetHeight;
    const pinReleased =
      trackHeight > viewport &&
      track.getBoundingClientRect().bottom <= viewport + 1;
    const idleMs = performance.now() - lastScrollAt.current;
    const ready = shouldCollapsePin({
      collapsed: collapsed.current,
      progress: progress.get(),
      raw: scrollYProgress.get(),
      pinReleased,
      idleMs,
    });
    if (!ready) {
      // Timers and the frame clock can disagree by a fraction of a ms.
      if (idleMs < PIN_SETTLE_MS) scheduleCollapse();
      return;
    }
    collapsed.current = true;
    const top = collapsedScrollY(window.scrollY, trackHeight, viewport);
    track.dataset.collapsed = "";
    window.scrollTo({ top, behavior: "instant" });
  };

  const scheduleCollapse = () => {
    if (collapsed.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(collapsePin, PIN_SETTLE_MS);
  };

  const follow = (raw: number) => {
    const next = latchProgress(progress.get(), raw);
    if (next !== progress.get()) progress.set(next);
  };
  useMotionValueEvent(scrollYProgress, "change", follow);
  // Every scroll event restarts the settle wait; past the track the raw
  // progress is clamped at 1 and stops reporting, the page scroll does not.
  useMotionValueEvent(scrollY, "change", () => {
    lastScrollAt.current = performance.now();
    if (progress.get() >= 1) scheduleCollapse();
  });
  // A reload restored below the hero starts complete and collapsed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount with the measured progress
  useEffect(() => {
    follow(scrollYProgress.get());
    if (progress.get() >= 1) scheduleCollapse();
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const headline = useTransform(progress, (p) => {
    const s = settleProgress(p);
    const eased = 1 - (1 - s) ** 3;
    return `scale(${1 - (1 - SETTLED_SCALE) * eased})`;
  });
  // The text block rises slowly through the whole pin, as in a camera move.
  const block = useTransform(
    progress,
    (p) =>
      `translateY(${(RISE_PX * (1 - Math.min(p / 0.93, 1))).toFixed(1)}px)`,
  );
  const outro = useTransform(progress, outroProgress);
  const outroLift = useTransform(
    outro,
    (o) => `translateY(${(14 * (1 - o)).toFixed(1)}px)`,
  );
  const outroPointer = useTransform(outro, (o) => (o > 0.5 ? "auto" : "none"));

  return (
    <section
      aria-labelledby="hero-title"
      className="lp-rise relative bg-(--lp-night) text-(--lp-night-ink)"
    >
      <div ref={trackRef} className="lp-rise-track">
        <div className="lp-rise-stage sticky top-0 flex h-dvh items-center justify-center overflow-hidden">
          <div aria-hidden="true" className="lp-rise-nebula absolute inset-0" />
          <HeroNetwork progress={progress} className="absolute inset-0" />
          <div aria-hidden="true" className="lp-rise-veil absolute inset-0" />

          <motion.div
            className="lp-rise-block relative z-10 flex w-full max-w-[1080px] flex-col items-center px-5 pt-16 text-center"
            style={{ transform: block }}
          >
            <motion.h1
              id="hero-title"
              className="lp-rise-title mb-5 font-(family-name:--lp-font-display) text-[clamp(52px,6.6vw,96px)] leading-[0.95] tracking-[-0.02em] md:mb-7 md:whitespace-nowrap"
              style={{ transform: headline }}
            >
              Recuerda lo que{" "}
              <em className="text-(--lp-violet-300) italic">estudias.</em>
            </motion.h1>

            <p className="sr-only">{HERO_SENTENCE}</p>
            <p
              aria-hidden="true"
              className="lp-rise-sentence max-w-[22ch] text-balance font-medium text-[clamp(30px,3.6vw,50px)] leading-[1.16] tracking-[-0.024em] md:max-w-none"
            >
              {HERO_LINES.map((line, lineIndex) => (
                <span key={line.join(" ")} className="md:block">
                  {line.map((word, wordIndex) => {
                    const index =
                      HERO_LINES.slice(0, lineIndex).flat().length + wordIndex;
                    return (
                      <RevealWord
                        key={`${word}-${index}`}
                        word={word}
                        index={index}
                        progress={progress}
                      />
                    );
                  })}
                </span>
              ))}
            </p>

            <motion.div
              className="lp-rise-outro mt-9 flex flex-col items-center gap-7"
              style={{
                opacity: outro,
                transform: outroLift,
                pointerEvents: outroPointer,
              }}
            >
              <p className="max-w-[580px] text-balance text-(--lp-night-ink-2) text-[17px] leading-[1.6] md:text-lg">
                Cogni convierte tus apuntes en flashcards, exámenes y preguntas
                de recuperación activa, y te dice qué repasar cada día para que
                no se te olvide.
              </p>
              <div
                data-part="hero-actions"
                className="flex flex-wrap justify-center gap-3"
              >
                <Link
                  href="/register"
                  className="lp-press lp-cta-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-bold text-[16px]"
                >
                  Empieza gratis
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <a
                  href="#como-funciona"
                  className="lp-press inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 font-semibold text-(--lp-night-ink) text-[16px] transition-colors duration-150 hover:bg-white/[0.06]"
                >
                  Ver cómo funciona
                </a>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// One word of the sentence: blurred and dim until its turn, then sharp.
function RevealWord({
  word,
  index,
  progress,
}: {
  word: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const reveal = useTransform(progress, (p) => wordProgress(p, index));
  const opacity = useTransform(reveal, (r) => WORD_DIM + (1 - WORD_DIM) * r);
  const filter = useTransform(
    reveal,
    (r) => `blur(${(WORD_BLUR_PX * (1 - r)).toFixed(2)}px)`,
  );
  return (
    <>
      <motion.span
        data-word=""
        className="lp-rise-word inline-block"
        style={{ opacity, filter }}
      >
        {word}
      </motion.span>{" "}
    </>
  );
}
