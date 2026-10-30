"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { motion } from "motion/react";
import Link from "next/link";
import { AsciiTexture } from "./ascii-texture";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// "Empieza hoy": the page's bookend. The lilac of the questions sinks back
// into the hero's violet night (the dusk band reversed), the letters gather
// as it darkens, and one centred line with one action closes the page. The
// headline settles from a slight blur as it enters, the section's one
// signature motion (opacity and filter only; under reduced motion Motion
// drops the move and keeps the fade). "hoy" is the italic keyword, in the
// flashcards yellow over the night.
export function Closing() {
  return (
    <section
      id="empieza"
      aria-labelledby="empieza-title"
      className="lp-closing relative overflow-hidden px-5 pt-[140px] pb-[120px] text-center md:px-10 md:pt-[160px] md:pb-[150px]"
    >
      <span
        aria-hidden="true"
        data-nav-theme="light"
        className="absolute inset-x-0 top-0 h-[22%]"
      />
      <span
        aria-hidden="true"
        data-nav-theme="dark"
        className="absolute inset-x-0 bottom-0 h-[78%]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <AsciiTexture
          variant="dissolve"
          flip
          seed={29}
          className="absolute inset-0 size-full font-(family-name:--lp-font-mono)"
        />
      </div>
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center">
        <motion.p
          className="flex items-center gap-3 font-(family-name:--lp-font-mono) text-(--lp-violet-100) text-[16px] uppercase tracking-[0.14em] md:text-[20px]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <span
            aria-hidden="true"
            className="size-2 bg-(--lp-yellow) md:size-2.5"
          />
          Empieza hoy
        </motion.p>
        <motion.h2
          id="empieza-title"
          className="lp-headline mt-6 text-white md:mt-8"
          initial={{ opacity: 0, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.08 }}
        >
          Tu primer repaso empieza{" "}
          <em className="lp-headline-accent lp-accent-yellow">hoy</em>.
        </motion.h2>
        <motion.p
          className="mt-7 max-w-[36ch] text-(--lp-on-dark-2) text-[18px] leading-[1.55] md:text-[21px]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
        >
          Sube tu primer apunte: tu primera sesión está lista hoy mismo.
        </motion.p>
        <Link
          href="/register"
          className="lp-press lp-cta-primary mt-9 inline-flex items-center gap-2.5 rounded-full px-[34px] py-[18px] font-(family-name:--lp-font-head) font-semibold text-[18px]"
        >
          Empieza gratis
          <ArrowRight aria-hidden="true" className="size-[18px]" />
        </Link>
      </div>
    </section>
  );
}
