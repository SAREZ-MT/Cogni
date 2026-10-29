"use client";

import { Layers, RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { PixelTile } from "@/shared/ui/pixel-tile";
import {
  type FanShape,
  type FanTechnique,
  fanPose,
  fanStack,
  fanTransition,
} from "@/shared/ui/technique-fan";
import { cn } from "@/shared/ui/utils";

// Per technique: how the three cards fan out, their front and back boxes
// (negative margins centre them on the stage) and their colours. Flashcards
// and recall prompts are landscape cards; the exam is a portrait sheet.
// Colours are the technique pastels (yellow, mint, pink) and their -fg inks.
const LOOK: Record<
  FanTechnique,
  {
    shape: FanShape;
    front: string;
    back: string;
    backTone: string;
    edge: string;
  }
> = {
  flashcards: {
    shape: { tiltDeg: 8, spreadPx: 84, outerDropPx: 10, middleLiftPx: -4 },
    front: "-mt-[74px] -ml-[110px] h-[148px] w-[220px] rounded-[16px]",
    back: "-mt-[64px] -ml-[96px] h-[128px] w-[192px] rounded-[15px]",
    backTone: "bg-pastel-yellow",
    edge: "border-pastel-yellow-fg/15",
  },
  recall: {
    // Stacked more than fanned: prompt cards waiting in a pile.
    shape: { tiltDeg: 5, spreadPx: 64, outerDropPx: 12, middleLiftPx: -6 },
    front: "-mt-[76px] -ml-[114px] h-[152px] w-[228px] rounded-[16px]",
    back: "-mt-[66px] -ml-[100px] h-[132px] w-[200px] rounded-[15px]",
    backTone: "bg-pastel-mint",
    edge: "border-pastel-mint-fg/15",
  },
  exams: {
    shape: { tiltDeg: 5, spreadPx: 64, outerDropPx: 8, middleLiftPx: -4 },
    front: "-mt-[94px] -ml-[75px] h-[188px] w-[150px] rounded-[10px]",
    back: "-mt-[84px] -ml-[67px] h-[168px] w-[134px] rounded-[10px]",
    backTone: "bg-pastel-pink",
    edge: "border-pastel-pink-fg/15",
  },
};

// Painted left, right, then front, so the front card sits on top.
const CARDS = [
  { slot: "left", poseIndex: 0, front: false },
  { slot: "right", poseIndex: 2, front: false },
  { slot: "front", poseIndex: 1, front: true },
] as const;

// A blinking caret that rests under reduced motion (CSS only).
function Caret({ className }: { className: string }) {
  return (
    <span
      data-part="caret"
      className={cn(
        "ml-0.5 inline-block h-3.5 w-[2px] rounded-full motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

function FlashcardFace() {
  return (
    <div className="flex size-full flex-col p-[18px] text-left">
      <PixelTile tone="yellow" icon={Layers} size={36} />
      <span className="mt-3.5 font-semibold text-[20px] text-fg leading-tight">
        ¿Qué es…?
      </span>
      <span className="mt-auto flex items-center gap-1 font-medium text-[11px] text-pastel-yellow-fg">
        <RotateCw aria-hidden="true" size={12} strokeWidth={2} />
        Toca para voltear
      </span>
    </div>
  );
}

function RecallFace() {
  return (
    <div className="flex size-full flex-col p-[18px] text-left">
      <span className="self-start rounded-pill bg-pastel-mint px-2 py-0.5 font-semibold text-[10px] text-pastel-mint-fg">
        Pregunta abierta
      </span>
      <span className="mt-2.5 font-semibold text-[16px] text-fg leading-snug">
        ¿Cómo lo explicarías?
      </span>
      <span className="mt-auto flex items-center rounded-lg border border-pastel-mint-fg/20 border-dashed bg-pastel-mint/40 px-2.5 py-2 text-[11.5px] text-fg-muted">
        Explícalo con tus palabras…
        <Caret className="bg-technique-recall-outline" />
      </span>
    </div>
  );
}

const OPTIONS = ["Opción A", "Opción B", "Opción C"] as const;
const SELECTED = "Opción B";

function ExamFace() {
  return (
    <div className="flex size-full flex-col p-3.5 text-left">
      <span className="font-semibold text-[10px] text-pastel-pink-fg">
        Pregunta 1
      </span>
      <span className="mt-2 h-1.5 w-[88%] rounded-full bg-neutral-200" />
      <span className="mt-1.5 h-1.5 w-[58%] rounded-full bg-neutral-200" />
      <span className="mt-auto flex flex-col gap-1.5">
        {OPTIONS.map((option) => {
          const selected = option === SELECTED;
          return (
            <span
              key={option}
              data-part="option"
              data-selected={selected ? "true" : "false"}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-[5px] font-medium text-[10px]",
                selected
                  ? "border-technique-exam-outline/50 bg-pastel-pink text-pastel-pink-fg"
                  : "border-border-default text-fg-secondary",
              )}
            >
              <span
                className={cn(
                  "flex size-2.5 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-technique-exam-outline bg-technique-exam-outline"
                    : "border-neutral-300",
                )}
              >
                {selected ? (
                  <span className="size-1 rounded-full bg-white" />
                ) : null}
              </span>
              {option}
            </span>
          );
        })}
      </span>
    </div>
  );
}

const FACE: Record<FanTechnique, () => ReactNode> = {
  flashcards: FlashcardFace,
  recall: RecallFace,
  exams: ExamFace,
};

export interface TechniqueEmptyArtProps {
  technique: FanTechnique;
  className?: string;
}

// Decorative hero of a technique hub's empty state (Phase 8 H10, user
// request 2026-10-29), the sibling of the notebooks hub's `NotebookFan`
// and the empty notebook's `PageSheetFan`: three cards in the technique's
// pastel fanned with the shared `TechniqueFan` helpers, the front one white
// with generic example content — a flashcard's question side with a flip
// hint and a pixel tile (flashcards), an open prompt whose answer line
// waits with a blinking caret (recall), or an exam sheet with options A–C
// and one chosen (exams). On mount the cards settle once from a squared
// stack; under reduced motion only the transition changes (never
// `initial`, so hydration matches) and the caret stays still. The 400×196
// stage scales down in steps with its own column, like `PageSheetFan`, so
// it never overflows. Hidden from assistive technology.
export function TechniqueEmptyArt({
  technique,
  className,
}: TechniqueEmptyArtProps) {
  const reduce = useReducedMotion() ?? false;
  const look = LOOK[technique];
  const Face = FACE[technique];
  return (
    <div
      aria-hidden="true"
      data-slot="technique-empty-art"
      data-technique={technique}
      className={cn("@container w-full", className)}
    >
      <div className="relative mx-auto h-[49px] max-w-[400px] @[180px]:h-[88px] @[220px]:h-[118px] @[300px]:h-[157px] @[400px]:h-[196px]">
        <div className="absolute top-0 left-1/2 h-[196px] w-[400px] origin-top -translate-x-1/2 scale-[0.25] @[180px]:scale-[0.45] @[220px]:scale-[0.6] @[300px]:scale-[0.8] @[400px]:scale-100">
          {CARDS.map((card, order) => (
            <motion.div
              key={card.slot}
              data-part="fan-card"
              data-card={card.slot}
              initial={fanStack(look.shape)}
              animate={fanPose(card.poseIndex, CARDS.length, look.shape)}
              transition={fanTransition(reduce, order)}
              className={cn(
                "absolute top-1/2 left-1/2 border shadow-[0_1px_1px_rgb(0_0_0/0.05),0_12px_20px_-6px_rgb(0_0_0/0.14)]",
                look.edge,
                card.front
                  ? cn("z-10 bg-white", look.front)
                  : cn(look.backTone, look.back),
              )}
            >
              {card.front ? <Face /> : null}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
