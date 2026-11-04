import type { Metadata } from "next";
import {
  Bitter,
  Caveat,
  DM_Sans,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import { SITE_NAME, shareMetadata } from "./_lib/share-metadata";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// H7 (editor polish round 2): faces the editor's "Texto" menu offers next to
// the system stacks. next/font self-hosts them (no external origin); they
// are not preloaded, so a page only downloads them when its text uses them.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

const bitter = Bitter({
  variable: "--font-bitter",
  subsets: ["latin"],
  preload: false,
});

// Phase 8 H11: the handwritten answer in the active recall hub's empty
// state (TechniqueEmptyArt, `.tea-hand`) is its only user. Self-hosted by
// next/font (CSP-safe, no Google request) and not preloaded, so only a
// page that shows that answer downloads it.
const caveat = Caveat({
  variable: "--font-handwriting",
  subsets: ["latin"],
  weight: "500",
  preload: false,
});

const ROOT_TITLE = "Cogni · Recuerda lo que estudias";
const ROOT_DESCRIPTION =
  "Convierte tus apuntes en flashcards, exámenes y preguntas de recuperación activa, y repasa cada día lo que estás a punto de olvidar.";

export const metadata: Metadata = {
  // Absolute URLs for og:image, og:url and canonical links. Read directly
  // (not through clientEnv) so a missing variable never breaks rendering.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: ROOT_TITLE,
  description: ROOT_DESCRIPTION,
  applicationName: SITE_NAME,
  ...shareMetadata({
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
  }),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${jetBrainsMono.variable} ${inter.variable} ${bitter.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
