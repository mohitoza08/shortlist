import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Geist: tight, neutral UI face (same family of choice as Linear/Vercel-class products).
// Geist Mono: every number and every quoted CV line, so data reads as data.
// Instrument Serif: used in exactly three places (score numerals, hero line, empty states) so it stays a signature.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument", display: "swap", weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Shortlist", template: "%s · Shortlist" },
  description: "The right CVs, first.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{ style: { borderRadius: 12, border: "1px solid var(--line)", fontFamily: "var(--font-geist)", boxShadow: "var(--shadow-pop)" } }}
        />
      </body>
    </html>
  );
}
