import { Caveat, Instrument_Serif, Inter, Manrope } from "next/font/google";
import { connection } from "next/server";
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

// Section headlines (Dovetail-style display sans). Inter's optical-size
// axis switches to its tight display cut at headline sizes, which Manrope's
// wide geometric forms cannot match at 100px.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Only used for small annotations further down the page.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  preload: false,
});

// The proxy sends a nonce-based CSP with 'strict-dynamic'
// (src/shared/config/security-headers.ts), and Next.js only stamps the
// nonce on scripts while rendering a request. A prerendered /landing,
// /ciencia or /creditos carries nonce-less scripts that the browser blocks
// under `next start`, so every marketing page renders per request
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// "Forcing dynamic rendering"), as the legal pages already do.
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  return (
    <div
      className={`lp ${instrumentSerif.variable} ${manrope.variable} ${inter.variable} ${caveat.variable} min-h-dvh`}
    >
      <LandingMotionConfig>{children}</LandingMotionConfig>
    </div>
  );
}
