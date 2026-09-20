import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PriceSnap — Estimation de revente par photo",
    short_name: "PriceSnap",
    description:
      "Photographiez un objet : identification IA, recherche d'annonces comparables en direct sur le web, fourchette de prix et conseils de vente.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c0e",
    theme_color: "#0b0c0e",
    lang: "fr",
    categories: ["shopping", "utilities", "finance"],
    icons: [
      { src: "/icons/icon.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
      { src: "/icons/icon.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Scanner un objet",
        short_name: "Scanner",
        url: "/scan",
        icons: [{ src: "/icons/icon.png", sizes: "1254x1254" }],
      },
      {
        name: "Historique",
        short_name: "Historique",
        url: "/history",
        icons: [{ src: "/icons/icon.png", sizes: "1254x1254" }],
      },
    ],
  };
}
