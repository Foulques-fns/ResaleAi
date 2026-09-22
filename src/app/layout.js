export const metadata = {
    title: "ResaleAI — Estimation de valeur de revente",
    description: "Estimez la valeur de revente d'un objet à partir d'annonces comparables réelles, avec identification produit, historique et conseils de mise en vente.",
    icons: { icon: "/brand/resaleai-mark.svg", apple: "/icons/icon.png" },
};
export default function RootLayout({ children }) {
    return (<html lang="fr">
      <body>{children}</body>
    </html>);
}
