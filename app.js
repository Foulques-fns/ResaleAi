/* ============================================================
   ResaleAI — bibliothèque commune (vanilla JS)
   i18n FR/EN · navigation · icônes SVG · PWA · stockage local
   ============================================================ */
"use strict";

/* ──────────────────────────────────────────────────────────────
   CONFIGURATION BACKEND
   Remplacez cette URL par celle de votre backend Next.js déployé
   (ex. https://resaleai.vercel.app).
   Laissez vide ("") si le frontend et le backend sont sur le même
   domaine (cas de l'hébergement Next.js classique).
   ────────────────────────────────────────────────────────────── */
const API_BASE = (function () {
  const stored = localStorage.getItem("ps:api_base");
  if (stored) return stored;
  // Détection auto pour l'URL de preview de la plateforme
  if (location.hostname.includes("e2b.app")) return "";
  return "";
})();

/* Wrapper fetch qui préfixe automatiquement les appels /api/ et gère les timeouts */
const apiFetch = async (path, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeout || 45000);
  try {
    const res = await fetch(API_BASE + path, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
};

const PS = (() => {
  const DICTS = {
    fr: {
      appName: "ResaleAI",
      tagline: "Estimez la valeur de revente à partir du marché réel.",
      nav: { home: "Accueil", scan: "Scanner", history: "Historique", alerts: "Alertes", settings: "Paramètres" },
      common: { back: "Retour", loading: "Chargement…", lang: "English", ago: "il y a", offline: "Hors-ligne", seeAll: "Tout voir" },
      home: {
        heroA: "La valeur de revente",
        heroB: "de votre objet, rapidement.",
        sub: "Prenez une photo, identifiez précisément l'objet et comparez-le à de vraies annonces du marché pour obtenir une estimation claire et exploitable.",
        scan: "Scanner un objet",
        recent: "Estimations récentes",
        empty: "Aucune estimation — scannez votre premier objet !",
        install: "Installer l'app",
        potential: "Valeur potentielle",
        sold: "Déjà revendu",
        features: [
          ["Identification précise", "Marque, modèle, référence et indices produits détectés à partir de vos photos."],
          ["Marché en direct", "Annonces comparées en temps réel sur Vinted, eBay, Leboncoin et d'autres sources."],
          ["Estimation claire", "Fourchette bas / moyen / haut calculée sur des annonces d'occasion réellement pertinentes."],
          ["Aide à la mise en vente", "Plateformes, mots-clés, photos et texte d'annonce prêts à l'emploi."],
        ],
        offlineNote: "Fonctionne hors-ligne pour consulter vos estimations sauvegardées.",
        privacy: "Confidentialité",
      },
      scan: {
        title: "Scanner un objet",
        photoHint: "Ajoutez face, dos, étiquette, défauts — plus il y en a, mieux c'est.",
        cam: "Ouvrir la caméra",
        gal: "Galerie",
        crop: "Recadrer",
        camErr: "Caméra indisponible ou accès refusé. Utilisez la galerie ou l'appareil photo natif.",
        camNative: "Appareil photo natif",
        condition: "État de l'objet",
        notes: "Notes (optionnel)",
        notesPh: "Marque lue sur l'étiquette, défauts, accessoires inclus…",
        barcode: "Code-barres (optionnel)",
        barcodePh: "ISBN / EAN / UPC",
        lookup: "Rechercher",
        scanCode: "Scanner",
        scanCodeLive: "Scanner le code-barres",
        scanCodeHint: "Pointez le code-barres devant la caméra.",
        barcodeFound: "Produit trouvé",
        barcodeDetected: "Code détecté",
        barcodeNotFound: "Code non reconnu.",
        barcodeUnavailable: "Le scan live n'est pas pris en charge sur ce navigateur. Essayez la saisie manuelle ou prenez une photo nette du code.",
        analyze: "Lancer l'estimation",
        describe: "Décrire l'objet manuellement",
        steps: ["Analyse des photos…", "Recherche d'annonces comparables sur le web…", "Calcul de la fourchette…", "Préparation des conseils…"],
        netErr: "Recherche web impossible : vérifiez votre connexion internet.",
        netProbe: "Connexion vérifiée en cours…",
        aiMissing: "La vision IA n'est pas configurée. Décrivez l'objet — le prix restera calculé sur de vraies annonces web.",
        hypTitle: "L'analyse hésite — confirmez l'objet",
        hypHint: "Choisissez la bonne identification pour éviter une estimation fausse, ou corrigez-la.",
        identified: "Objet identifié",
        manual: "Quel est cet objet ?",
        namePh: "ex : Cafetière Krups Dolce Gusto, iPhone 12…",
        brand: "Marque",
        model: "Modèle / réf.",
        lot: "Mode lot",
        lotHint: "Les estimations s'ajoutent au lot en cours (vide-grenier).",
        addLot: "Ajouter au lot",
        lotView: "Voir le lot",
        lotTotal: "Total du lot",
        lotClear: "Vider",
        lotCleared: "Lot vidé",
        cropTitle: "Ajuster le cadrage",
        cropHelp: "Glissez pour recentrer, molette/pincement pour zoomer",
        confirm: "Valider",
        torch: "Torche",
        flip: "Retourner",
        shoot: "Prendre la photo",
        offlineTitle: "Vous êtes hors-ligne",
        offlineBody: "La recherche de prix en direct nécessite internet. Vos estimations sauvegardées restent consultables.",
      },
      res: {
        range: "Fourchette de prix",
        low: "Bas",
        mid: "Moyen",
        high: "Haut",
        median: "Médiane web",
        basedOn: "Basé sur",
        listings: "annonces comparées",
        usedNote: "Fourchette calculée sur les annonces d'occasion — le neuf est affiché à titre indicatif.",
        dropped: "annonces non pertinentes écartées",
        usedCount: "annonces d'occasion",
        confidence: "confiance",
        guided: "Identification guidée",
        comparables: "Annonces comparables trouvées",
        view: "Voir l'annonce",
        refresh: "Relancer la recherche web",
        insights: "Analyse du marché",
        rarity: "Rareté",
        demand: "Demande",
        sellTime: "Délai de vente probable",
        days: "jours",
        anomalies: "Annonces suspectes écartées",
        noListings: "Aucune annonce comparable récupérée. Affinez le nom ou réessayez.",
        trace: "Traçabilité des recherches",
        newPrice: "Prix du neuf repéré",
        advice: "Conseils pour vendre",
        platforms: "Plateformes recommandées",
        keywords: "Mots-clés pour votre titre",
        photosTip: "Photos à ajouter",
        period: "Période favorable",
        copyListing: "Annonce prête à copier",
        copy: "Copier",
        copied: "Copié !",
        warnings: "À savoir",
        markSold: "Marquer comme vendu",
        soldAt: "Vendu",
        soldPricePh: "Prix de vente réel",
        soldPlatform: "Plateforme (ex : Vinted)",
        save: "Enregistrer",
        delete: "Supprimer",
        cond: { new: "Neuf", like_new: "Très bon état", good: "Bon état", fair: "État correct", poor: "Abîmé" },
        rarities: { rare: "Rare", uncommon: "Peu courant", common: "Courant", very_common: "Très courant", unknown: "Inconnu" },
        demands: { high: "Forte", medium: "Moyenne", low: "Faible", unknown: "Inconnue" },
        newChip: "Neuf",
      },
      hist: {
        title: "Historique",
        subtitle: "Toutes vos estimations sauvegardées",
        filter: "Filtrer…",
        empty: "Aucune estimation enregistrée.",
        offlineBadge: "Mode hors-ligne : données en cache",
        potential: "Potentiel total (encore à vendre)",
        realized: "Total réellement revendu",
        sold: "Vendu",
      },
      alerts: {
        title: "Alertes prix",
        subtitle: "Surveillez l'évolution du marché",
        create: "Créer une alerte",
        queryPh: "ex : cafetière Krups Dolce Gusto",
        dir: "Notifier si",
        dirs: { any: "le prix bouge", rise: "le prix monte", drop: "le prix baisse" },
        baseline: "Prix de référence",
        check: "Vérifier maintenant",
        checking: "Vérification en direct…",
        delete: "Supprimer",
        empty: "Aucune alerte. Créez-en une ici.",
        changed: "Le marché a bougé",
        unchanged: "Marché stable",
        notif: "Activer les notifications",
        denied: "Notifications refusées par le navigateur.",
        last: "Dernière vérif.",
        never: "jamais",
      },
      cam: "Caméra",
      gallery: "Galerie",
      newObject: "Nouvel objet du lot",
      retry: "Réessayer",
      cached: "Estimations en cache",
      settings: {
        title: "Paramètres",
        loginTitle: "Créez votre compte",
        loginSub: "Sauvegardez vos estimations et synchronisez vos alertes sur tous vos appareils.",
        google: "Continuer avec Google",
        apple: "Apple (bientôt)",
        ms: "Microsoft (bientôt)",
        email: "Email (bientôt)",
        phone: "Téléphone (bientôt)",
        pwa: "Installer l'application",
        pwaSub: "Ajoutez ResaleAI à votre écran d'accueil pour un accès rapide.",
        install: "Installer",
        installed: "Application installée",
        linked: "Comptes liés",
        vinted: "Lier Vinted",
        ebay: "Lier eBay",
        vintedSub: "Générez vos annonces directement (Simulé)",
        ebaySub: "Synchronisation des ventes (Simulé)",
        prefs: "Préférences",
        lang: "Langue de l'interface",
        logout: "Se déconnecter",
        loggedInAs: "Connecté en tant que",
        data: "Données & Confidentialité",
        clearHistory: "Effacer l'historique",
        cleared: "Historique effacé"
      },
    },
    en: {
      appName: "ResaleAI",
      tagline: "Estimate resale value from real market data.",
      nav: { home: "Home", scan: "Scan", history: "History", alerts: "Alerts", settings: "Settings" },
      common: { back: "Back", loading: "Loading…", lang: "Français", ago: "", offline: "Offline", seeAll: "See all" },
      home: {
        heroA: "Know the resale value",
        heroB: "of your item, fast.",
        sub: "Take a photo, identify the exact item and compare it with real market listings to get a clear, decision-ready valuation.",
        scan: "Scan an item",
        recent: "Recent estimates",
        empty: "No estimates yet — scan your first item!",
        install: "Install the app",
        potential: "Potential value",
        sold: "Already resold",
        features: [
          ["Precise identification", "Brand, model, reference and product cues extracted from your photos."],
          ["Live market data", "Comparable listings fetched in real time from Vinted, eBay, Leboncoin and more."],
          ["Clear valuation", "Low / mid / high range computed from genuinely relevant used listings."],
          ["Listing guidance", "Platforms, keywords, photo checklist and listing copy ready to use."],
        ],
        offlineNote: "Works offline to browse your saved estimates.",
        privacy: "Privacy",
      },
      scan: {
        title: "Scan an item",
        photoHint: "Add front, back, labels, flaws — the more the better.",
        cam: "Open camera",
        gal: "Gallery",
        crop: "Crop",
        camErr: "Camera unavailable or access denied. Use the gallery or the native camera app.",
        camNative: "Native camera",
        condition: "Item condition",
        notes: "Notes (optional)",
        notesPh: "Brand from the label, flaws, included accessories…",
        barcode: "Barcode (optional)",
        barcodePh: "ISBN / EAN / UPC",
        lookup: "Look up",
        scanCode: "Scan",
        scanCodeLive: "Scan barcode",
        scanCodeHint: "Point the barcode at the camera.",
        barcodeFound: "Product found",
        barcodeDetected: "Code detected",
        barcodeNotFound: "Code not recognized.",
        barcodeUnavailable: "Live barcode scanning is not supported on this browser. Try manual entry or take a sharp photo of the code.",
        analyze: "Run estimate",
        describe: "Describe the item manually",
        steps: ["Analyzing photos…", "Searching comparable listings on the web…", "Computing the range…", "Preparing selling advice…"],
        netErr: "Web search failed: check your internet connection.",
        netProbe: "Checking connection…",
        aiMissing: "AI vision is not configured. Describe the item — the price will still be computed from real web listings.",
        hypTitle: "The analysis is unsure — confirm the item",
        hypHint: "Pick the right identification to avoid a wrong estimate, or correct it.",
        identified: "Identified item",
        manual: "What is this item?",
        namePh: "e.g.: Krups Dolce Gusto coffee maker, iPhone 12…",
        brand: "Brand",
        model: "Model / ref.",
        lot: "Lot mode",
        lotHint: "Estimates are added to the current lot (yard sale).",
        addLot: "Add to lot",
        lotView: "View lot",
        lotTotal: "Lot total",
        lotClear: "Clear",
        lotCleared: "Lot cleared",
        cropTitle: "Adjust framing",
        cropHelp: "Drag to recenter, slider to zoom",
        confirm: "Confirm",
        torch: "Torch",
        flip: "Flip",
        shoot: "Take the photo",
        offlineTitle: "You are offline",
        offlineBody: "Live price search needs internet. Saved estimates remain available.",
      },
      res: {
        range: "Price range",
        low: "Low",
        mid: "Mid",
        high: "High",
        median: "Web median",
        basedOn: "Based on",
        listings: "comparable listings",
        usedNote: "Range computed on used listings — new prices shown for reference only.",
        dropped: "irrelevant listings discarded",
        usedCount: "used listings",
        confidence: "confidence",
        guided: "Guided identification",
        comparables: "Comparable listings found",
        view: "View listing",
        refresh: "Re-run live web search",
        insights: "Market analysis",
        rarity: "Rarity",
        demand: "Demand",
        sellTime: "Likely time to sell",
        days: "days",
        anomalies: "Suspicious listings excluded",
        noListings: "No comparable listing fetched. Refine the name or retry.",
        trace: "Search traceability",
        newPrice: "New price spotted",
        advice: "Selling advice",
        platforms: "Recommended platforms",
        keywords: "Keywords for your title",
        photosTip: "Photos to add",
        period: "Best period",
        copyListing: "Ready-to-copy listing",
        copy: "Copy",
        copied: "Copied!",
        warnings: "Good to know",
        markSold: "Mark as sold",
        soldAt: "Sold",
        soldPricePh: "Actual sale price",
        soldPlatform: "Platform (e.g.: Vinted)",
        save: "Save",
        delete: "Delete",
        cond: { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Damaged" },
        rarities: { rare: "Rare", uncommon: "Uncommon", common: "Common", very_common: "Very common", unknown: "Unknown" },
        demands: { high: "High", medium: "Medium", low: "Low", unknown: "Unknown" },
        newChip: "New",
      },
      hist: {
        title: "History",
        subtitle: "All your saved estimates",
        filter: "Filter…",
        empty: "No saved estimate.",
        offlineBadge: "Offline mode: cached data",
        potential: "Total potential (unsold)",
        realized: "Total actually resold",
        sold: "Sold",
      },
      alerts: {
        title: "Price alerts",
        subtitle: "Monitor the market for an item type",
        create: "Create alert",
        queryPh: "e.g.: Krups Dolce Gusto coffee maker",
        dir: "Notify when",
        dirs: { any: "price moves", rise: "price rises", drop: "price drops" },
        baseline: "Reference price",
        check: "Check now",
        checking: "Checking live…",
        delete: "Delete",
        empty: "No alert. Create one here.",
        changed: "Market moved",
        unchanged: "Market stable",
        notif: "Enable notifications",
        denied: "Notifications denied by the browser.",
        last: "Last check",
        never: "never",
      },
      cam: "Camera",
      gallery: "Gallery",
      newObject: "New item in lot",
      retry: "Retry",
      cached: "Cached estimates",
      settings: {
        title: "Settings",
        loginTitle: "Create your account",
        loginSub: "Save your estimates and sync your alerts across all your devices.",
        google: "Continue with Google",
        apple: "Apple (soon)",
        ms: "Microsoft (soon)",
        email: "Email (soon)",
        phone: "Phone (soon)",
        pwa: "Install the application",
        pwaSub: "Add ResaleAI to your home screen for quick access.",
        install: "Install",
        installed: "App installed",
        linked: "Linked Accounts",
        vinted: "Link Vinted",
        ebay: "Link eBay",
        vintedSub: "Generate your listings directly (Simulated)",
        ebaySub: "Sales synchronization (Simulated)",
        prefs: "Preferences",
        lang: "Interface Language",
        logout: "Log out",
        loggedInAs: "Logged in as",
        data: "Data & Privacy",
        clearHistory: "Clear history",
        cleared: "History cleared"
      },
    },
  };

  const CONDITIONS = ["new", "like_new", "good", "fair", "poor"];

  function getLang() {
    try {
      const l = localStorage.getItem("ps:lang");
      return l === "en" ? "en" : "fr";
    } catch {
      return "fr";
    }
  }
  let LANG = getLang();
  function setLang(l) {
    LANG = l === "en" ? "en" : "fr";
    try {
      localStorage.setItem("ps:lang", LANG);
    } catch {}
    location.reload();
  }
  const t = () => DICTS[LANG];

  const I = (paths, size = 20) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    camera: I('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'),
    scan: I('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'),
    history: I('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
    bell: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    bellRing: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/><path d="M22 8c0-2.3-.8-4.3-2-6"/>'),
    bellPlus: I('<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/><path d="M19 2v6"/><path d="M16 5h6"/>'),
    back: I('<path d="m15 18-6-6 6-6"/>'),
    globe: I('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
    check: I('<path d="M20 6 9 17l-5-5"/>'),
    x: I('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    trash: I('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
    tag: I('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>'),
    search: I('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    image: I('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    zoom: I('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>'),
    copy: I('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
    refresh: I('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
    alert: I('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    shield: I('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
    wallet: I('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'),
    gem: I('<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>'),
    clock: I('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    list: I('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
    plus: I('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    layers: I('<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'),
    download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
    wifiOff: I('<path d="M12 20h.01"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><path d="m2 2 20 20"/>'),
    barcode: I('<path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>'),
    arrowUR: I('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
    zap: I('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
    lampOn: I('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    flip: I('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
    piggy: I('<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>'),
    user: I('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    settings: I('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
    mail: I('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
    phone: I('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    google: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.3 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.2c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 2.9-4.2 2.9-7.4z"/><path d="M12 21.7c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.4v2.5c1.6 3.2 4.9 5.4 8.6 5.4z"/><path d="M6.6 13.8c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.3H3.4C2.7 8.7 2.3 10.3 2.3 12s.4 3.3 1.1 4.7l3.2-2.9z"/><path d="M12 6.1c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 3.1 14.6 2.3 12 2.3c-3.7 0-7 2.2-8.6 5.4l3.2 2.5c.8-2.3 2.9-4.1 5.4-4.1z"/></svg>',
    apple: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.6c-1.8 0-3.6-1.1-4.7-1.1-1.2 0-2.8 1.1-4.3 1.1-1.9 0-3.7-1.1-4.6-2.8-2-3.4-.5-8.5 1.4-11.2 1-.9 2.1-1.5 3.3-1.5 1.5 0 2.9 1 3.9 1 1 0 2.6-1.2 4.4-1.2 1.3 0 2.5.5 3.4 1.5-3 1.8-2.5 6.2.6 7.4-1 2.3-2 4.9-3.4 6.8z"/><path d="M12.5 3c-.8 1-2.1 1.7-3.4 1.6.2-1.4.8-2.6 1.7-3.5C11.5.2 12.8-.3 14 0c-.2 1.3-.7 2.2-1.5 3z"/></svg>',
    ms: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 11H2V2h9v9zm11 0h-9V2h9v9zM11 22H2v-9h9v9zm11 0h-9v-9h9v9z"/></svg>',
  };

  const ICON_SRC_COLORS = { vinted: "#09B1BA", ebay: "#E53238", leboncoin: "#FF6E14", dealabs: "#2A3FBF", web: "#9aa3af" };
  function sourceDot(source) {
    const d = document.createElement("span");
    d.className = "src-dot";
    d.style.background = ICON_SRC_COLORS[source] || "rgba(154,163,175,0.7)";
    return d;
  }

  function fmtPrice(v, currency = "EUR") {
    const n = Number(v) || 0;
    try {
      return new Intl.NumberFormat(LANG === "en" ? "en-GB" : "fr-FR", {
        style: "currency",
        currency,
        maximumFractionDigits: n < 100 ? 2 : 0,
      }).format(n);
    } catch {
      return `${n} €`;
    }
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    const rtf = new Intl.RelativeTimeFormat(LANG === "en" ? "en" : "fr", { numeric: "auto" });
    if (min < 1) return rtf.format(0, "minute");
    if (min < 60) return rtf.format(-min, "minute");
    const h = Math.floor(min / 60);
    if (h < 24) return rtf.format(-h, "hour");
    const d = Math.floor(h / 24);
    if (d < 30) return rtf.format(-d, "day");
    return rtf.format(-Math.floor(d / 30), "month");
  }

  function spinnerHTML(cls = "spinner") {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  }

  function toast(msg, ms = 2400) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  const NEW_RE = /neuf( avec| sans| sous)?|neuve|brand new|new with tags|new without tags|sealed|promo/i;
  function isNewListing(l) {
    if (l.source === "dealabs") return true;
    return NEW_RE.test(`${l.conditionText || ""} ${l.title}`);
  }

  function listingRow(l) {
    const a = document.createElement("a");
    a.className = "card listing-row";
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow";
    const dot = sourceDot(l.source);
    const mid = document.createElement("div");
    mid.style.minWidth = "0";
    mid.style.flex = "1";
    const title = document.createElement("p");
    title.className = "listing-title";
    title.textContent = l.title;
    const meta = document.createElement("p");
    meta.className = "listing-meta";
    meta.appendChild(document.createTextNode(l.sourceLabel));
    if (l.conditionText) meta.appendChild(document.createTextNode(` · ${l.conditionText}`));
    if (l.date) meta.appendChild(document.createTextNode(` · ${l.date}`));
    if (isNewListing(l)) {
      const chip = document.createElement("span");
      chip.className = "chip chip--warn";
      chip.style.cssText = "padding:0.1rem 0.4rem;font-size:0.5625rem";
      chip.textContent = t().res.newChip;
      meta.appendChild(chip);
    }
    mid.append(title, meta);
    const rightWrap = document.createElement("div");
    rightWrap.style.textAlign = "right";
    const price = document.createElement("div");
    price.className = "listing-price num";
    price.textContent = fmtPrice(l.price, l.currency);
    const view = document.createElement("span");
    view.style.cssText = "display:inline-flex;align-items:center;gap:0.2rem;font-size:0.625rem;font-weight:600;text-transform:uppercase;color:var(--fog)";
    view.innerHTML = `${t().res.view} ${ICONS.arrowUR.replace('width="20" height="20"', 'width="10" height="10"')}`;
    rightWrap.append(price, document.createElement("br"), view);
    a.append(dot, mid, rightWrap);
    return a;
  }

  const store = {
    get(k, fb) {
      try {
        const r = localStorage.getItem(k);
        return r ? JSON.parse(r) : fb;
      } catch {
        return fb;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch {}
    },
  };

  const cacheHistory = (items) => store.set("ps:cache:history", (items || []).slice(0, 60));
  const readHistory = () => store.get("ps:cache:history", []);
  const cacheEst = (id, data) => store.set("ps:cache:est:" + id, data);
  const readEst = (id) => store.get("ps:cache:est:" + id, null);
  const getLot = () => store.get("ps:lot", []);
  const addLot = (id) => {
    const l = getLot();
    if (!l.includes(id)) l.push(id);
    store.set("ps:lot", l);
    return l;
  };
  const removeLot = (id) => {
    const l = getLot().filter((x) => x !== id);
    store.set("ps:lot", l);
    return l;
  };
  const clearLot = () => store.del("ps:lot");

  async function compressImage(file, maxSide = 1024, quality = 0.72) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return c.toDataURL("image/jpeg", quality);
  }

  async function cropImage(src, { zoom, offsetX, offsetY, outSize = 900 }) {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    const c = document.createElement("canvas");
    c.width = c.height = outSize;
    const ctx = c.getContext("2d");
    const base = Math.max(outSize / img.width, outSize / img.height) * zoom;
    const dw = img.width * base;
    const dh = img.height * base;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outSize, outSize);
    ctx.drawImage(img, (outSize - dw) / 2 + offsetX, (outSize - dh) / 2 + offsetY, dw, dh);
    return c.toDataURL("image/jpeg", 0.8);
  }

  let deferredPrompt = null;
  function registerPWA() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      document.querySelectorAll("[data-install]").forEach((b) => b.classList.remove("hidden"));
    });
  }
  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.querySelectorAll("[data-install]").forEach((b) => b.classList.add("hidden"));
  }
  const isOnline = () => navigator.onLine;

  function chrome(active, { back } = {}) {
    const T = t();
    const header = document.createElement("header");
    header.className = "topbar";
    const inner = document.createElement("div");
    inner.className = "topbar-inner";

    if (back) {
      const b = document.createElement("button");
      b.className = "back-btn";
      b.innerHTML = `${ICONS.back} <span>${T.common.back}</span>`;
      b.onclick = () => (history.length > 1 ? history.back() : (location.href = "/index.html"));
      inner.appendChild(b);
    } else {
      const logo = document.createElement("a");
      logo.className = "logo";
      logo.href = "/index.html";
      logo.innerHTML = `<span class="logo-badge"><img src="/brand/resaleai-mark.svg" alt="ResaleAI"/></span><span class="logo-word"><span class="accent">Resale</span><span class="suffix">AI</span></span>`;
      inner.appendChild(logo);
    }

    const actions = document.createElement("div");
    actions.className = "topbar-actions";
    if (!isOnline()) {
      const off = document.createElement("span");
      off.className = "chip chip--warn";
      off.innerHTML = `${ICONS.wifiOff.replace('width="20" height="20"', 'width="12" height="12"')} ${T.common.offline}`;
      actions.appendChild(off);
    }
    const langBtn = document.createElement("span");
    langBtn.className = "chip";
    langBtn.style.cursor = "pointer";
    langBtn.innerHTML = `<button>${LANG.toUpperCase()} ⇄</button>`;
    langBtn.onclick = () => setLang(LANG === "fr" ? "en" : "fr");
    actions.appendChild(langBtn);
    inner.appendChild(actions);
    header.appendChild(inner);
    document.body.prepend(header);

    const nav = document.createElement("nav");
    nav.className = "tabbar";
    const tabs = [
      ["home", "/index.html", ICONS.scan, T.nav.home],
      ["scan", "/scan.html", ICONS.camera, T.nav.scan],
      ["history", "/history.html", ICONS.history, T.nav.history],
      ["alerts", "/alerts.html", ICONS.bell, T.nav.alerts],
      ["settings", "/settings.html", ICONS.settings, T.nav.settings],
    ];
    const grid = document.createElement("div");
    grid.className = "tabbar-grid";
    for (const [key, href, icon, label] of tabs) {
      const a = document.createElement("a");
      a.className = "tab" + (key === active ? " active" : "");
      a.href = href;
      a.innerHTML = `<span class="tab-ico">${icon}</span><span>${label}</span><span class="tab-bar"></span>`;
      grid.appendChild(a);
    }
    nav.appendChild(grid);
    document.body.appendChild(nav);
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }

  return {
    t,
    get lang() {
      return LANG;
    },
    setLang,
    ICONS,
    fmtPrice,
    timeAgo,
    spinnerHTML,
    toast,
    listingRow,
    isNewListing,
    cacheHistory,
    readHistory,
    cacheEst,
    readEst,
    getLot,
    addLot,
    removeLot,
    clearLot,
    compressImage,
    cropImage,
    registerPWA,
    install,
    isOnline,
    chrome,
    copyText,
    CONDITIONS,
  };
})();
