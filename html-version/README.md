# Version HTML / CSS / JavaScript

Cette version conserve le projet Next.js original dans `src/` et ajoute une interface autonome dans ce dossier.

- `index.html` : interface
- `styles.css` : styles
- `app.js` : logique de navigation, caméra, galerie, identification et estimation
- `manifest.webmanifest` : PWA

## Caméra
Le bouton **Caméra** utilise `navigator.mediaDevices.getUserMedia()` et demande l'autorisation du navigateur. Sur téléphone, l'accès caméra nécessite HTTPS (ou localhost).

## Backend
Les appels `/api/estimate`, `/api/history` et `/api/barcode` sont conservés et utilisés par l'interface HTML. Pour garder les estimations IA et les recherches réelles, cette interface doit être servie avec le backend du projet.

Le projet Next.js d'origine n'a pas été supprimé.
