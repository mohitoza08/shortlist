import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", weight: ["400", "500", "600"] });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "Shortlist", template: "%s · Shortlist" },
  description: "The right CVs, first.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: 10, border: "1px solid var(--line)" } }} />
      </body>
    </html>
  );
}
