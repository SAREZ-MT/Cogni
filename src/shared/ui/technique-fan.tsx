"use client";

import { Brain, FileCheck, Layers, type LucideIcon, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  TECHNIQUE_PAIR_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { cn } from "@/shared/ui/utils";

export type FanTechnique = "flashcards" | "recall" | "exams";

export interface TechniqueFanProps {
  // Technique mini cards fanned behind the notebook, left to right. Keys,
  // not icon components: a server parent cannot pass components to this
  // client atom.
  techniques: FanTechnique[];
  className?: string;
}

const TECHNIQUE: Record<
  FanTechnique,
  { icon: LucideIcon; tone: TechniqueTone }
> = {
  flashcards: { icon: Layers, tone: "yellow" },
  recall: { icon: Brain, tone: "green" },
  exams: { icon: FileCheck, tone: "rose" },
};

// Geometry of a fan: outer tilt, horizontal spread, how far the outer
// cards drop and how far the middle one lifts (negative is up). Phase 8
// H4-T3: shared with `NotebookFan`, which passes its own shape.
export interface FanShape {
  tiltDeg: number;
  spreadPx: number;
  outerDropPx: number;
  middleLiftPx: number;
}

// The outer cards sit lower than the middle one, like a hand of cards.
const TECHNIQUE_SHAPE: FanShape = {
  tiltDeg: 8,
  spreadPx: 80,
  outerDropPx: 10,
  middleLiftPx: -4,
};

// Resting pose of card `index` out of `count`: evenly spread from
// -tilt to +tilt, the middle card upright and lifted.
export function fanPose(
  index: number,
  count: number,
  shape: FanShape = TECHNIQUE_SHAPE,
) {
  if (count < 2) return { x: 0, y: shape.middleLiftPx, rotate: 0 };
  const t = (index / (count - 1)) * 2 - 1; // -1 … 1
  const edge = Math.abs(t);
  return {
    x: Math.round(t * shape.spreadPx),
    y: Math.round(
      shape.middleLiftPx + edge * (shape.outerDropPx - shape.middleLiftPx),
    ),
    rotate: Math.round(t * shape.tiltDeg),
  };
}

// Before the entrance every card sits squared up in one stack.
export function fanStack(shape: FanShape = TECHNIQUE_SHAPE) {
  return { x: 0, y: shape.outerDropPx, rotate: 0 };
}

// One settle from stack to fan on mount: a spring without overshoot,
// staggered left to right, finished within 500 ms. Reduced motion jumps
// straight to the fan. Only the transition changes, never `initial`, so the
// server markup is identical either way.
export function fanTransition(reduce: boolean, index: number) {
  if (reduce) return { duration: 0 };
  return {
    type: "spring" as const,
    bounce: 0,
    visualDuration: 0.36,
    delay: 0.06 + index * 0.04,
  };
}

function Line({ className }: { className: string }) {
  return <span className={cn("block h-1 rounded-full", className)} />;
}

// Miniature of each technique's real screen, a few strokes only.
function CardBody({ technique }: { technique: FanTechnique }) {
  if (technique === "flashcards") {
    // The card front itself: the question, then the "Ver respuesta" pill.
    return (
      <div className="flex flex-col items-center gap-1.5 pt-2">
        <Line className="w-12 bg-neutral-300" />
        <Line className="w-8 bg-neutral-200" />
        <span className="mt-1 block h-2.5 w-10 rounded-full bg-pastel-yellow" />
      </div>
    );
  }
  if (technique === "recall") {
    // A prompt, then the answer being written.
    return (
      <div className="flex flex-col gap-1.5">
        <Line className="w-full bg-neutral-300" />
        <Line className="w-9 bg-neutral-200" />
        <div className="mt-0.5 flex flex-col gap-1 rounded-md bg-pastel-mint px-1.5 py-1.5">
          <Line className="w-full bg-pastel-mint-fg/25" />
          <Line className="w-7 bg-pastel-mint-fg/25" />
        </div>
      </div>
    );
  }
  // An exam question: three options, the middle one chosen.
  return (
    <div className="flex flex-col gap-1">
      {[false, true, false].map((chosen, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decoration
          key={index}
          data-part="option"
          className={cn(
            "flex items-center gap-1.5 rounded-[5px] px-1 py-[3px]",
            chosen && "bg-pastel-pink",
          )}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full border",
              chosen
                ? "border-pastel-pink-fg/70 bg-pastel-pink-fg/70"
                : "border-neutral-300",
            )}
          />
          <Line
            className={cn(
              index === 1 ? "w-9" : "w-11",
              chosen ? "bg-pastel-pink-fg/30" : "bg-neutral-200",
            )}
          />
        </span>
      ))}
    </div>
  );
}

// Layered depth: a hairline border plus a tight contact shadow and a soft,
// offset ambient one (kokonutui card stack), never a glow.
const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_20px_-8px_rgb(0_0_0/0.14)]";

// The "new notebook" in front: a small cover with a violet spine (ring
// holes punched in it), a title stroke and a soft "+" chip for the first
// page. Violet stays in the spine and the chip; the cover is white like the
// cards. Not interactive: the real action is the button under the title.
function MiniNotebook() {
  return (
    <div
      data-part="notebook"
      className={cn(
        "absolute bottom-0 left-1/2 -ml-9 flex h-[76px] w-[72px] overflow-hidden rounded-[8px_14px_14px_8px] border border-border-default bg-card",
        CARD_SHADOW,
      )}
    >
      <span
        data-part="notebook-spine"
        className="flex w-3 shrink-0 flex-col items-center justify-center gap-2 border-primary-200 border-r bg-primary-100"
      >
        {[0, 1, 2].map((hole) => (
          <span key={hole} className="size-1 rounded-full bg-card" />
        ))}
      </span>
      <span className="flex flex-1 flex-col justify-between p-2">
        <span className="flex flex-col gap-1">
          <span className="block h-1 w-8 rounded-full bg-primary-200" />
          <span className="block h-1 w-5 rounded-full bg-neutral-200" />
        </span>
        <span
          data-part="notebook-add"
          className="flex size-6 items-center justify-center self-end rounded-full border border-primary-200 bg-primary-50 text-primary-600"
        >
          <Plus size={13} strokeWidth={2} />
        </span>
      </span>
    </div>
  );
}

// Decorative hero illustration (Phase 8 Home empty state): the three study
// techniques as mini cards, each hinting its own screen, fanned like a hand
// of flashcards behind a mini notebook, so an empty screen still says what
// Cogni does. On mount the cards settle once from a squared stack into the
// fan and stay there (stable transform, nothing else moves). No text, no
// data, hidden from assistive technology.
export function TechniqueFan({ techniques, className }: TechniqueFanProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div
      aria-hidden="true"
      data-slot="technique-fan"
      className={cn("relative h-[150px] w-[300px] shrink-0", className)}
    >
      {techniques.map((technique, index) => {
        const { icon: Icon, tone } = TECHNIQUE[technique];
        return (
          <motion.div
            key={technique}
            data-part="fan-card"
            data-technique={technique}
            initial={fanStack()}
            animate={fanPose(index, techniques.length)}
            transition={fanTransition(reduce, index)}
            className={cn(
              "absolute bottom-[40px] left-1/2 -ml-[46px] flex h-[112px] w-[92px] origin-bottom flex-col gap-2 rounded-[14px] border border-border-default bg-card p-2.5",
              CARD_SHADOW,
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-[6px]",
                TECHNIQUE_PAIR_CLASS[tone],
              )}
            >
              <Icon size={12} strokeWidth={1.75} />
            </span>
            <CardBody technique={technique} />
          </motion.div>
        );
      })}
      <MiniNotebook />
    </div>
  );
}
