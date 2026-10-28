import {
  Brain,
  FileCheck,
  Layers,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import type { HeadlineImage } from "./headline-object";

export type TechniqueKey = "flashcards" | "recall" | "exams" | "ai";

// What the front card of each placeholder prints: the same generic example
// content the app shows (never a real subject), and the platform icon.
const FRONT: Record<
  TechniqueKey,
  { icon: LucideIcon; kicker: string; text: string }
> = {
  flashcards: {
    icon: Layers,
    kicker: "Anverso",
    text: "¿Qué describe el concepto clave de esta página?",
  },
  recall: {
    icon: Brain,
    kicker: "Explícalo con tus palabras",
    text: "¿Cómo le explicarías el concepto clave a alguien que no lo conoce?",
  },
  exams: {
    icon: FileCheck,
    kicker: "Pregunta 3 de 10",
    text: "¿Qué idea resume mejor el concepto clave?",
  },
  ai: {
    icon: Sparkles,
    kicker: "Borrador de la IA",
    text: "¿Qué es el concepto clave?",
  },
};

// The large visual of a technique panel. It takes its tone from the
// panel's data-tone (--tech*, landing.css).
//
// TODO(higgsfield): generate one illustration per technique in the line of
// the platform's own (the fanned notebooks of the notebooks hub empty
// state, src/shared/ui/notebook-fan.tsx: soft 160° gradient covers in the
// technique colour, a fine darker border, white cards, one platform icon in
// a tile), square, transparent or light ground, about 1200×1200, and save
// them as public/landing/technique-flashcards.webp, technique-recall.webp,
// technique-exams.webp and technique-ai.webp. Pass them to <Techniques
// art={{ flashcards: { src, alt }, … }} />. Until then this placeholder
// draws the same idea from shapes: two tinted covers fanned behind a white
// card that prints the technique's example question.
export function TechniqueArt({
  technique,
  image,
}: {
  technique: TechniqueKey;
  image?: HeadlineImage;
}) {
  if (image) {
    return (
      <div className="lp-art relative aspect-square w-full">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 768px) 560px, 90vw"
          className="object-contain"
        />
      </div>
    );
  }
  const front = FRONT[technique];
  const Icon = front.icon;
  return (
    <div
      aria-hidden="true"
      data-art={technique}
      className="lp-art lp-art-stage @container relative aspect-square w-full"
    >
      <span className="lp-art-cover lp-art-cover-back" />
      <span className="lp-art-cover lp-art-cover-mid">
        <span className="lp-art-ribbon" />
      </span>
      <span className="lp-art-card">
        <span className="lp-art-tile">
          <Icon strokeWidth={1.75} className="size-[55%]" />
        </span>
        <span className="lp-art-kicker font-(family-name:--lp-font-mono)">
          {front.kicker}
        </span>
        <span className="lp-art-text font-(family-name:--lp-font-head)">
          {front.text}
        </span>
      </span>
    </div>
  );
}
