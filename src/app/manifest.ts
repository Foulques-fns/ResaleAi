import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResaleAi — Estimation de revente par photo",
    short_name: "ResaleAi",
    description:
      "Photographiez un objet : identification IA, recherche d'annonces comparables en direct sur le web, fourchette de prix et conseils de vente.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050812",
    theme_color: "#050812",
    lang: "fr",
    categories: ["shopping", "utilities", "finance"],
    icons: [
      { src: "/logo.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Scanner un objet",
        short_name: "Scanner",
        url: "/scan",
        icons: [{ src: "/logo.png", sizes: "1254x1254" }],
      },
      {
        name: "Historique",
        short_name: "Historique",
        url: "/history",
        icons: [{ src: "/logo.png", sizes: "1254x1254" }],
      },
    ],
  };
}
