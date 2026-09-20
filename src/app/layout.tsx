import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { AppChrome } from "@/components/chrome";
import { SWRegistrar } from "@/components/pwa";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-var", weight: ["500", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body-var", weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: {
    default: "PriceSnap — Combien vaut votre objet ?",
    template: "%s · PriceSnap",
  },
  description:
    "Photographiez un objet à revendre : identification par IA, recherche d'annonces comparables en direct sur le web, fourchette de prix réaliste et conseils de vente.",
  applicationName: "PriceSnap",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "PriceSnap" },
  icons: { icon: "/icons/icon.png", apple: "/icons/icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="bg-ink text-bone antialiased">
        <LangProvider>
          <SWRegistrar />
          <div className="bg-grain bg-mesh min-h-dvh">
            <AppChrome>{children}</AppChrome>
          </div>
        </LangProvider>
      </body>
    </html>
  );
}
