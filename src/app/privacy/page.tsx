import type { Metadata } from "next";
import { ShieldCheck, Database, EyeOff, Trash2, Cookie } from "lucide-react";

export const metadata: Metadata = { title: "Confidentialité" };

const SECTIONS = [
  {
    icon: Database,
    title: "Ce que nous stockons",
    body: "Les photos que vous prenez, les résultats d'estimation (objet identifié, prix calculés, annonces comparées) et vos paramètres. Aucun compte n'est requis : l'historique est associé à cette installation. Aucune donnée n'est vendue ni partagée avec des tiers à des fins commerciales.",
  },
  {
    icon: EyeOff,
    title: "Vos photos restent vôtres",
    body: "Les photos sont compressées sur votre appareil avant envoi, puis utilisées uniquement pour l'identification et la recherche de prix. Elles ne sont jamais publiées. Lorsque la vision IA est activée, elles sont transmises chiffrées au fournisseur d'IA configuré (OpenAI / Anthropic / Google) exclusivement pour l'analyse.",
  },
  {
    icon: Cookie,
    title: "Stockage local & PWA",
    body: "L'application utilise le stockage local de votre navigateur (cache hors-ligne, préférences de langue, lot en cours). Aucun cookie publicitaire, aucun traceur tiers.",
  },
  {
    icon: Trash2,
    title: "Suppression",
    body: "Vous pouvez supprimer chaque estimation individuellement depuis sa fiche. La suppression est immédiate et définitive (photos incluses).",
  },
  {
    icon: ShieldCheck,
    title: "Transparence des prix",
    body: "Chaque estimation indique exactement quelles sources web ont été interrogées, quand, et combien d'annonces ont servi au calcul. Les estimations sont indicatives et ne remplacent pas l'avis d'un expert pour les objets de valeur.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-5">
      <div className="reveal">
        <h1 className="text-display text-2xl font-bold">Confidentialité</h1>
        <p className="mt-1 text-sm text-fog">Simple et sans surprise — vos données ne quittent pas votre usage.</p>
      </div>
      {SECTIONS.map((s, i) => (
        <section key={s.title} className={`card reveal reveal-${Math.min(i + 1, 5)} p-4`}>
          <p className="flex items-center gap-2.5 text-sm font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid">
              <s.icon className="size-4" />
            </span>
            {s.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fog">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
