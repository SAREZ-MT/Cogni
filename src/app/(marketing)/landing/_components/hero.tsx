import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { HeroEditor } from "./hero-editor";

// Hero E, "El titular se escribe solo". The headline, subtitle and actions
// are static server-rendered text, visible from the first paint; only the
// editor fragment on the right is animated (and decorative).
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="lp-hero overflow-hidden px-4 pt-[120px] pb-20 md:px-10 xl:px-20 xl:pt-[142px] xl:pb-24"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-16 xl:flex-row xl:items-center xl:gap-10">
        <div className="flex max-w-[560px] flex-col gap-7 xl:w-[560px] xl:shrink-0">
          <p className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 font-bold text-(--lp-on-dark) text-sm">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-(--lp-mint)"
            />
            Tus apuntes, convertidos en un plan para no olvidar
          </p>
          <h1
            id="hero-title"
            className="font-(family-name:--lp-font-display) text-(--lp-paper) text-[clamp(56px,7vw,96px)] leading-none tracking-[-0.02em]"
          >
            Recuerda lo que{" "}
            <span className="inline-block rounded-lg bg-(--lp-yellow) pr-3.5 pb-1 pl-2.5 text-(--lp-ink)">
              estudias.
            </span>
          </h1>
          <p className="max-w-[560px] text-(--lp-on-dark-2) text-lg leading-[1.55] md:text-[19px]">
            Cogni convierte tus apuntes en flashcards, exámenes y preguntas de
            recuperación activa, y te dice qué repasar cada día para que no se
            te olvide.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <Link
              href="/register"
              className="lp-press inline-flex items-center gap-2.5 rounded-full bg-(--lp-yellow) px-[30px] py-[17px] font-extrabold text-(--lp-ink) text-[17px]"
            >
              Empieza gratis
              <ArrowRight aria-hidden="true" className="size-[18px]" />
            </Link>
            <a
              href="#como-funciona"
              className="lp-press inline-flex items-center gap-2.5 rounded-full border border-white/25 px-[26px] py-4 font-bold text-(--lp-on-dark) text-[17px] hover:bg-white/5"
            >
              <Play aria-hidden="true" className="size-4" />
              Ver cómo funciona
            </a>
          </div>
          <p className="text-(--lp-on-dark-3) text-sm">
            Gratis · Para mayores de 18 años · Importa PDF, Word y PowerPoint
          </p>
        </div>
        <HeroEditor />
      </div>
    </section>
  );
}
