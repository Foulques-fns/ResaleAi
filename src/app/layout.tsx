import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PriceSnap — Estimation de revente par photo",
  description:
    "Photographiez un objet à revendre : identification IA, recherche d'annonces comparables en direct sur le web, fourchette de prix et conseils de vente.",
  icons: { icon: "/icons/icon.png", apple: "/icons/icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
