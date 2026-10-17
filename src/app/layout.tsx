import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// The two typefaces the design system names (tailwind.config.ts). Until
// 2026-09 nothing actually loaded them, so every official saw the system
// font fallback instead. next/font downloads them at BUILD time and serves
// them from this site's own domain: an official's browser never contacts
// Google, and the generated fallback metrics keep text from jumping when the
// real font arrives. The latin subset covers English and Tagalog (ñ included).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
import { ToastProvider } from "@/components/ui/Toast";

// Every page renders per request, the static ones (/, /not-authorized, the
// 404) included. The Content-Security-Policy's nonce is new on each request
// and Next.js can only stamp it on a page's scripts while rendering it; a page
// prerendered at build time would carry no nonce, and the browser would
// refuse to run its scripts. Most pages were per-request already.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LipaAction — Admin Web Console",
  // Said [Static UI mockup] until 2026-09 — false since the console went
  // live against the real database, and now public on the deployed URL.
  description:
    "Barangay officials’ console for reviewing and routing LipaAction incident reports.",
  // A sign-in page for pre-provisioned officials has no business in a search
  // index. Nothing here is secret — the page is public — but listing it only
  // invites credential-stuffing traffic at an OTP form.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-brand-600 focus:inline-flex focus:min-h-11 focus:items-center focus:px-3 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
