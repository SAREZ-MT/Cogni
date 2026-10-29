import type { Metadata } from "next";
import { Bitter, DM_Sans, Inter, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Cogni",
  description: "Tu plataforma de estudio con repaso espaciado.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${jetBrainsMono.variable} ${inter.variable} ${bitter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
