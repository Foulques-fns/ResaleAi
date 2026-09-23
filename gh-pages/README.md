# ResaleAI — Version GitHub Pages

Site statique publié sur GitHub Pages.

## Déploiement

1. Copiez le contenu de ce dossier dans un dépôt GitHub
2. Allez dans **Settings → Pages → Deploy from a branch → main → / (root)**
3. GitHub Pages servira `index.html` à la racine

## Structure

```
/                      ← racine publiée par GitHub Pages
├── index.html         ← page d'accueil
├── scan.html          ← scanner (caméra, code-barres)
├── estimation.html    ← résultat d'estimation
├── history.html       ← historique
├── alerts.html        ← alertes prix
├── settings.html      ← paramètres / compte
├── offline.html       ← mode hors-ligne
├── privacy.html       ← confidentialité
├── styles.css         ← design system
├── app.js             ← lib commune (i18n, nav, utils)
├── index.js / scan.js / …   ← scripts de chaque page
├── manifest.webmanifest      ← PWA
├── sw.js              ← Service Worker
├── brand/             ← logos SVG
└── icons/             ← icônes PWA
```

## Fonctionnalités sans backend (100% statiques)

- Navigation entre pages
- Caméra photo HD
- **Scan code-barres live** (`BarcodeDetector` — Chrome/Android)
- Recadrage de photos
- Mode hors-ligne (cache Service Worker)
- Installation PWA
- Historique local (localStorage)
- Mode lot
- Paramètres / préférences

## Fonctionnalités nécessitant le backend (Next.js)

Ces fonctions effectuent des appels vers `/api/...` qui nécessitent
un serveur Next.js déployé séparément (ex. Vercel, Railway, Render) :

| Fonctionnalité | Endpoint API |
|---|---|
| Estimation de prix | `POST /api/estimate` |
| Historique persistant | `GET /api/history` |
| Alertes prix | `GET/POST /api/alerts` |
| Vérification alerte | `POST /api/alerts/check` |
| Résolution code-barres | `GET /api/barcode` |
| Connexion Google | `GET/POST /api/auth/...` |

### Configurer l'URL de l'API

Ajoutez en tête de `app.js` :

```js
const API_BASE = "https://votre-backend.vercel.app"; // URL de votre backend Next.js
```

puis remplacez `fetch("/api/...)` par `fetch(API_BASE + "/api/...")` dans les fichiers JS.

## Backend (Next.js)

Le code source Next.js se trouve dans le dossier parent du projet.
Il peut être déployé sur Vercel avec la commande :

```bash
vercel deploy
```
