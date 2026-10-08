import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ShminkAI — makeup prilagođen tvom licu",
  description:
    "AI analizira vidljive karakteristike lica i kreira personalizirani makeup look prilagođen tvojim crtama.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4eee9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr" className={`${dmSans.variable} ${cormorant.variable}`}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
