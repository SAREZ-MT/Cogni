import type { Icon } from "@phosphor-icons/react/dist/lib/types";
import Image from "next/image";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";

// Phosphor glyphs, drawn in the fill weight inside a tinted tile.
export type PillarPoint = { icon: Icon; title: string; text: string };

// The pillar's hue for its feature icons (landing.css .lp-ficon).
export type IconTone = "yellow" | "violet" | "mint" | "rose";

export type PillarImage = { src: string; alt: string };

// RemNote-style block under each band: a heading, three short points with
// small icons, and a visual on the other side. Sides alternate per pillar.
export function PillarBlock({
  heading,
  points,
  iconTone,
  visualSide,
  visual,
}: {
  heading: string;
  points: readonly PillarPoint[];
  iconTone: IconTone;
  visualSide: "left" | "right";
  visual: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-14 px-4 pt-16 pb-24 md:px-10 md:pt-[100px] md:pb-[120px] lg:flex-row lg:items-center lg:gap-16 xl:gap-20 xl:px-20">
      <Reveal
        className={`flex flex-1 flex-col gap-8 ${visualSide === "left" ? "lg:order-2" : ""}`}
      >
        <h3 className="max-w-[520px] font-(family-name:--lp-font-display) text-(--lp-ink) text-[clamp(36px,3.6vw,48px)] leading-[1.08] tracking-[-0.01em]">
          {heading}
        </h3>
        <ul className="flex max-w-[520px] flex-col gap-6">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span
                aria-hidden="true"
                data-tone={iconTone}
                className="lp-ficon flex size-11 shrink-0 items-center justify-center rounded-[13px]"
              >
                <Icon weight="fill" className="size-[22px]" />
              </span>
              <span className="flex flex-col gap-1 pt-0.5">
                <span className="font-extrabold text-(--lp-ink) text-[17px]">
                  {title}
                </span>
                <span className="text-(--lp-ink-3) text-[15px] leading-normal">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
      <div className="w-full lg:w-[min(56%,780px)] lg:shrink-0">{visual}</div>
    </div>
  );
}

// Slot for a pillar's visual. Today it holds a coded mock; when a generated
// image exists (public/landing/pillar-*.webp) it sits behind the mock as
// a soft backdrop, so the mock stays the readable layer.
export function PillarVisual({
  image,
  children,
}: {
  image?: PillarImage;
  children: ReactNode;
}) {
  if (!image) return <div className="relative">{children}</div>;
  return (
    <div className="relative">
      <div className="absolute -inset-6 overflow-hidden rounded-[36px] opacity-60">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
