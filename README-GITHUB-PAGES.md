# ResaleAI — version GitHub Pages

Cette version conserve les fichiers HTML/CSS/JS de `public/app` et les place à la racine du dépôt afin que GitHub Pages trouve `index.html`.

## Mise en ligne
Dans GitHub : Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## Important
GitHub Pages est un hébergement statique. Les routes Next.js présentes dans `nextjs-source/src/app/api` ne peuvent pas être exécutées par GitHub Pages. Les appels `/api/...` du frontend resteront donc indisponibles tant qu'un backend séparé n'est pas hébergé. Le code serveur original est conservé dans `nextjs-source/` et n'a pas été réécrit.

Les modifications apportées ici sont principalement structurelles, avec uniquement des chemins statiques rendus relatifs pour fonctionner sous une URL GitHub Pages de projet.
