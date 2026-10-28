import { Caveat, Instrument_Serif, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { LandingMotionConfig } from "./landing/_components/landing-motion-config";
import "./landing.css";

// Landing-local faces (Pencil frame "Landing · Prototipo v1"). next/font
// self-hosts them, so no visitor request reaches Google. JetBrains Mono is
// already loaded by the root layout (--font-jetbrains-mono) and reused here.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Only used for small annotations further down the page.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  preload: false,
});

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`lp ${instrumentSerif.variable} ${manrope.variable} ${caveat.variable} min-h-dvh`}
    >
      <LandingMotionConfig>{children}</LandingMotionConfig>
    </div>
  );
}
