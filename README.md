# ResaleAi

Version principale : **Next.js + API + base de données**.

## Fonctionnement

L'application principale est le dossier racine (`src/`). Elle contient les routes API nécessaires à :
- l'identification par image,
- l'estimation,
- la recherche de comparables,
- l'historique,
- les alertes,
- le code-barres.

`html-version/` est une version autonome d'interface qui conserve l'UI et la caméra, mais elle ne peut pas exécuter les routes `/api/*` sur un hébergement purement statique comme GitHub Pages.

## Déploiement recommandé

Utiliser un hébergeur Node/Next.js (par exemple Netlify) pour la version principale.

Build command:
`npm run build`

Start command:
`npm run start`

Variables d'environnement nécessaires selon les fonctions activées :
- `DATABASE_URL`
- une clé IA parmi `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` ou `GOOGLE_API_KEY`

La caméra utilise `navigator.mediaDevices.getUserMedia` côté navigateur et demande l'autorisation de l'appareil au moment du scan.

## Identité visuelle

Le logo fourni par le projet est `public/logo.png`. Le thème reprend le noir profond, le bleu électrique, le violet et les effets lumineux de la marque Resale.

## Important

GitHub Pages is not suitable for the complete version because it cannot execute the `/api/*` routes.
Do not replace the root Next.js project with only `html-version/` when you need real estimations.
