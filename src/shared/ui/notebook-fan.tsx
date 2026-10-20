"use client";

import { Brain, Layers, type LucideIcon, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { NotebookCover } from "@/shared/ui/notebook-cover";
import {
  type FanShape,
  fanPose,
  fanStack,
  fanTransition,
} from "@/shared/ui/technique-fan";
import { cn } from "@/shared/ui/utils";

type NotebookSlot = "left" | "right" | "front";

interface NotebookLook {
  name: string;
  meta: string;
  icon: LucideIcon;
  // Fan position (left to right) and stagger order.
  poseIndex: number;
  front: boolean;
  cover: string;
  title: string;
  subtitle: string;
  ribbon: string;
  tile: string;
}

// Sample subjects (decoration, not data): two vivid covers in the
// technique colours behind a violet "new notebook" (Phase 8 H4-T3, option D
// palette 1 "Técnicas vivas", user decision 2026-10-20). Rendered left,
// right, then front, so the new notebook paints on top.
const NOTEBOOKS: Record<NotebookSlot, NotebookLook> = {
  left: {
    name: "Historia",
    meta: "18 páginas",
    icon: Layers,
    poseIndex: 0,
    front: false,
    cover: "border-warning-500 from-amber-200 to-amber-400",
    title: "text-neutral-900",
    subtitle: "text-black/45",
    ribbon: "bg-white",
    tile: "border-warning-500 bg-white text-warning-700",
  },
  right: {
    name: "Biología",
    meta: "9 páginas",
    icon: Brain,
    poseIndex: 2,
    front: false,
    cover: "border-success-500 from-emerald-200 to-emerald-400",
    title: "text-neutral-900",
    subtitle: "text-black/45",
    ribbon: "bg-white",
    tile: "border-success-500 bg-white text-success-700",
  },
  front: {
    name: "Nueva materia",
    meta: "Tu primer cuaderno",
    icon: Plus,
    poseIndex: 1,
    front: true,
    cover: "border-primary-700 from-primary-500 to-primary-700",
    title: "text-white",
    subtitle: "text-white/75",
    ribbon: "bg-technique-flashcards-accent",
    tile: "border-white/30 bg-white/20 text-white",
  },
};

const ORDER: NotebookSlot[] = ["left", "right", "front"];

// Outer books ±9deg and 150px out, 10px lower; the front one upright and
// raised 2px.
const NOTEBOOK_SHAPE: FanShape = {
  tiltDeg: 9,
  spreadPx: 150,
  outerDropPx: 10,
  middleLiftPx: -2,
};

// The book drawing itself is the shared `NotebookCover` atom (Phase 8
// H4-T4); the fan only prints each sample's name, meta and icon tile on it.
function Notebook({ look }: { look: NotebookLook }) {
  const Icon = look.icon;
  return (
    <NotebookCover cover={look.cover} ribbon={look.ribbon}>
      <span className="absolute top-16 right-5 left-7 flex flex-col text-left">
        <span
          className={cn(
            "font-semibold leading-tight",
            look.front ? "text-[15px]" : "text-[13px]",
            look.title,
          )}
        >
          {look.name}
        </span>
        <span className={cn("mt-1 font-medium text-[10.5px]", look.subtitle)}>
          {look.meta}
        </span>
      </span>
      <span
        className={cn(
          "absolute bottom-[18px] left-7 flex size-[26px] items-center justify-center rounded-lg border",
          look.tile,
        )}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
    </NotebookCover>
  );
}

// Decorative hero of the notebooks hub's empty state (Phase 8 H4-T3, user
// decision 2026-10-20): three closed notebooks fanned — two sample
// subjects tilted out behind a larger, upright violet "Nueva materia" — so
// the screen shows what a library of notebooks will look like. On mount
// the books settle once from a squared stack into the fan with the
// `TechniqueFan` spring; under reduced motion only the transition changes,
// never `initial`, so hydration matches. The 560×236 stage scales down in
// steps with its own column (container queries, not the viewport: the
// sidebar may eat the width), so it never overflows. Hidden from assistive
// technology: the names are decoration, not data.
export function NotebookFan({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div
      aria-hidden="true"
      data-slot="notebook-fan"
      className={cn("@container w-full", className)}
    >
      <div className="relative mx-auto h-[52px] max-w-[560px] @[210px]:h-[94px] @[300px]:h-[132px] @[420px]:h-[177px] @[560px]:h-[236px]">
        <div className="absolute top-0 left-1/2 h-[236px] w-[560px] origin-top -translate-x-1/2 scale-[0.22] @[210px]:scale-[0.4] @[300px]:scale-[0.56] @[420px]:scale-75 @[560px]:scale-100">
          {ORDER.map((slot, order) => {
            const look = NOTEBOOKS[slot];
            return (
              <motion.div
                key={slot}
                data-part="fan-notebook"
                data-notebook={slot}
                initial={fanStack(NOTEBOOK_SHAPE)}
                animate={fanPose(look.poseIndex, ORDER.length, NOTEBOOK_SHAPE)}
                transition={fanTransition(reduce, order)}
                className={cn(
                  "absolute top-1/2 left-1/2",
                  look.front
                    ? "z-10 -mt-[113px] -ml-[90px] h-[226px] w-[180px]"
                    : "-mt-[104px] -ml-[83px] h-[208px] w-[166px]",
                )}
              >
                <Notebook look={look} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
