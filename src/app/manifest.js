export default function manifest() {
    return {
        name: "ResaleAI — Estimation de valeur de revente",
        short_name: "ResaleAI",
        description: "Estimez la valeur de revente d'un objet à partir d'annonces comparables réelles, avec identification produit, historique et conseils de mise en vente.",
        id: "/app/index.html",
        start_url: "/app/index.html",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f8fbff",
        theme_color: "#ffffff",
        lang: "fr",
        categories: ["shopping", "utilities", "finance"],
        icons: [
            { src: "/brand/resaleai-mark.svg", sizes: "128x128", type: "image/svg+xml", purpose: "any" },
            { src: "/icons/icon.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
            {
                name: "Scanner un objet",
                short_name: "Scanner",
                url: "/app/scan.html",
                icons: [{ src: "/icons/icon.png", sizes: "1254x1254" }],
            },
            {
                name: "Historique",
                short_name: "Historique",
                url: "/app/history.html",
                icons: [{ src: "/icons/icon.png", sizes: "1254x1254" }],
            },
        ],
    };
}
