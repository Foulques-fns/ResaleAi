import { CONDITION_LABELS } from "./pricing";
const CATEGORY_PLATFORMS = {
    mode: { fr: ["Vinted", "Leboncoin", "Vestiaire Collective (marques premium)"], en: ["Vinted", "Depop", "eBay"] },
    "high-tech": { fr: ["Leboncoin", "eBay (ventes constatées)", "Back Market (rachat)"], en: ["eBay", "Facebook Marketplace", "Swappa"] },
    "electro-menager": { fr: ["Leboncoin", "Facebook Marketplace", "eBay"], en: ["Facebook Marketplace", "eBay", "Gumtree"] },
    mobilier: { fr: ["Leboncoin", "Selency (design/ancien)", "Facebook Marketplace"], en: ["Facebook Marketplace", "eBay local", "Etsy (vintage)"] },
    deco: { fr: ["Leboncoin", "Selency", "Vinted (petits objets)"], en: ["eBay", "Etsy (vintage)", "Facebook Marketplace"] },
    jouets: { fr: ["Vinted", "Leboncoin", "eBay (collectors)"], en: ["eBay", "Vinted", "Facebook Marketplace"] },
    "jeux-video": { fr: ["eBay (prix constatés)", "Leboncoin", "Facebook Marketplace"], en: ["eBay", "PriceCharting (cote)", "Facebook Marketplace"] },
    "livres-media": { fr: ["Recyclivre / Momox (rachat)", "Vinted", "Leboncoin (séries)"], en: ["eBay", "Vinted", "Ziffit / World of Books"] },
    sport: { fr: ["Leboncoin", "Vinted", "Troc Vélo (vélos)"], en: ["Facebook Marketplace", "eBay", "Vinted"] },
    collection: { fr: ["eBay (enchères)", "Catawiki (objets côtés)", "Leboncoin"], en: ["eBay", "Catawiki", "Etsy"] },
    enfant: { fr: ["Vinted", "Leboncoin", "Passerelles/brocantes"], en: ["Vinted", "Facebook Marketplace"] },
    musique: { fr: ["Leboncoin", "Musicam / Zikinf (occasion)", "eBay"], en: ["Reverb", "eBay", "Facebook Marketplace"] },
    bricolage: { fr: ["Leboncoin", "eBay"], en: ["Facebook Marketplace", "eBay"] },
    "auto-moto": { fr: ["Leboncoin", "eBay"], en: ["eBay", "Facebook Marketplace"] },
    jardin: { fr: ["Leboncoin", "Facebook Marketplace"], en: ["Facebook Marketplace", "eBay"] },
    beaute: { fr: ["Vinted (neuf scellé uniquement)", "Leboncoin"], en: ["Vinted (sealed only)", "eBay"] },
    "art-antiquite": { fr: ["Catawiki (cote réelle)", "Expertise gratuite (maison de ventes)", "Selency"], en: ["Catawiki", "Auction house valuation", "1stDibs"] },
    autre: { fr: ["Leboncoin", "Vinted", "eBay"], en: ["eBay", "Vinted", "Facebook Marketplace"] },
};
const HIGH_VALUE_CATEGORIES = new Set(["art-antiquite", "collection"]);
const SEASON_BY_CATEGORY = {
    mode: { months: [2, 3, 9, 10], fr: "Printemps et rentrée sont les meilleurs moments pour le textile. Les articles d'hiver partent mieux d'octobre à décembre.", en: "Spring and back-to-school season are best for clothing. Winter items sell best October–December." },
    jardin: { months: [3, 4, 5], fr: "Le jardinage se vend au printemps (mars–mai), avant la saison.", en: "Garden gear sells in spring (March–May), ahead of the season." },
    sport: { months: [12, 1, 5], fr: "Fitness : janvier (bonnes résolutions). Sports d'hiver : octobre–novembre.", en: "Fitness: January (resolutions). Winter sports: October–November." },
    jouets: { months: [10, 11, 12], fr: "Les jouets explosent en valeur avant Noël (octobre–décembre). Publiez tôt.", en: "Toys peak before Christmas (October–December). List early." },
    "jeux-video": { months: [10, 11, 12], fr: "Consoles et jeux : forte demande avant les fêtes.", en: "Consoles and games see strong demand before the holidays." },
    deco: { months: [9, 10, 11], fr: "La déco se vend bien en automne, quand on réaménage l'intérieur.", en: "Home decor sells well in autumn when people nest indoors." },
    "electro-menager": { months: [8, 9], fr: "Rentrée = étudiants qui s'équipent : petit électro part vite fin août–septembre.", en: "Back-to-school: students buy small appliances late August–September." },
};
export function buildAdvice(input) {
    const { category, lang } = input;
    const isEn = lang === "en";
    const cat = category && CATEGORY_PLATFORMS[category] ? category : "autre";
    const platforms = (CATEGORY_PLATFORMS[cat][isEn ? "en" : "fr"] ?? CATEGORY_PLATFORMS.autre[isEn ? "en" : "fr"]).map((name, i) => ({
        name,
        reason: i === 0
            ? isEn
                ? "Largest audience for this category"
                : "Meilleure audience pour cette catégorie"
            : isEn
                ? "Good secondary option / price cross-check"
                : "Bon complément pour élargir ou vérifier la cote",
    }));
    const keywords = [];
    keywords.push(isEn ? "exact model name + reference" : "nom exact du modèle + référence");
    keywords.push(isEn ? "brand spelled fully" : "marque écrite en entier");
    keywords.push(isEn ? "condition details (box, accessories)" : "état détaillé (boîte, accessoires)");
    if (cat === "mode")
        keywords.push(isEn ? "size + color + material" : "taille + couleur + matière");
    if (cat === "jeux-video" || cat === "high-tech")
        keywords.push(isEn ? "serial visible? / tested & working" : "testé & fonctionnel, numéro de série visible");
    if (cat === "collection" || cat === "art-antiquite")
        keywords.push(isEn ? "year / edition / signature" : "année / édition / signature");
    const photoTips = isEn
        ? [
            "Natural light, plain background — first photo = the item alone, centered",
            "Shoot every side + label/tag/serial number",
            "Photograph flaws honestly (scratches, wear): builds trust, avoids disputes",
            "Add a size reference (ruler, hand) if dimensions matter",
        ]
        : [
            "Lumière naturelle, fond uni — 1re photo = l'objet seul, centré",
            "Photographier chaque face + étiquette / plaque / numéro de série",
            "Montrer honnêtement les défauts (rayures, usure) : évite les litiges",
            "Ajouter une référence de taille si les dimensions comptent",
        ];
    const season = cat in SEASON_BY_CATEGORY ? SEASON_BY_CATEGORY[cat] : null;
    const now = new Date().getMonth() + 1;
    const periodNote = season
        ? season[isEn ? "en" : "fr"] + (season.months.includes(now) ? (isEn ? " You are in the favorable window." : " Vous êtes dans la bonne période.") : "")
        : isEn
            ? "No clear seasonality for this category — anytime works."
            : "Pas de saisonnalité marquée pour cette catégorie — vous pouvez vendre toute l'année.";
    const negociationTip = isEn
        ? "List ~10% above your target price: buyers negotiate on Vinted/Leboncoin."
        : "Affichez ~10 % au-dessus de votre prix cible : les acheteurs négocient presque toujours.";
    return { platforms, keywords, photoTips, periodNote, negociationTip };
}
export function buildListingCopy(input) {
    const { itemName, brand, model, condition, notes, priceMid, lang } = input;
    const isEn = lang === "en";
    const cur = input.currency === "GBP" ? "£" : "€";
    const condLabel = isEn
        ? { new: "Brand new", like_new: "Excellent condition", good: "Good condition", fair: "Fair condition", poor: "Heavily worn / damaged" }[condition]
        : CONDITION_LABELS[condition];
    const lines = isEn
        ? [
            `${itemName}${brand ? ` — ${brand}` : ""}${model ? ` ${model}` : ""}`,
            ``,
            `Condition: ${condLabel}.`,
            notes?.trim() ? `Details: ${notes.trim()}` : null,
            ``,
            `Market estimate: around ${priceMid}${cur} (based on ${new Date().toLocaleDateString(isEn ? "en-GB" : "fr-FR")} comparables).`,
            ``,
            `Fast shipping / possible pickup. Any questions — feel free to ask!`,
        ]
        : [
            `${itemName}${brand ? ` — ${brand}` : ""}${model ? ` ${model}` : ""}`,
            ``,
            `État : ${condLabel}.`,
            notes?.trim() ? `Détails : ${notes.trim()}` : null,
            ``,
            `Estimation marché : environ ${priceMid}${cur} (comparables du ${new Date().toLocaleDateString("fr-FR")}).`,
            ``,
            `Envoi rapide / remise en main propre possible. N'hésitez pas pour toute question !`,
        ];
    return lines.filter((l) => l !== null).join("\n");
}
export function buildWarnings(input) {
    const { category, suspicious, stats, priceMid, lang, aiAvailable } = input;
    const isEn = lang === "en";
    const warnings = [];
    if (suspicious) {
        warnings.push((isEn
            ? "Warning — this item may be counterfeit, stolen, or illegal to resell: "
            : "Attention — cet objet semble contrefait, volé ou interdit à la revente : ") + suspicious +
            (isEn
                ? ". We cannot provide selling advice for such items."
                : ". Nous ne pouvons pas fournir de conseil de vente pour ce type d'objet."));
    }
    if (category && HIGH_VALUE_CATEGORIES.has(category)) {
        warnings.push(isEn
            ? "High-value category (art / antiques / collectibles): this estimate is indicative only. For significant value, consult a professional appraiser or an auction house (often free)."
            : "Catégorie à forte valeur (art / antiquités / collection) : cette estimation est indicative. Pour un objet de valeur, consultez un expert ou une maison de ventes (expertise souvent gratuite).");
    }
    if (priceMid >= 300) {
        warnings.push(isEn
            ? `Estimated value ≥ ${priceMid}€ — for valuable items, this AI/comps estimate does not replace an expert appraisal.`
            : `Valeur estimée ≥ ${priceMid} € — pour les objets de valeur, cette estimation par comparables ne remplace pas l'avis d'un expert.`);
    }
    if (stats.sampleSize === 0) {
        warnings.push(isEn
            ? "No comparable listing could be fetched live from the web for this query. Try refining the object name (brand, model) — the estimate below is intentionally conservative."
            : "Aucune annonce comparable n'a pu être récupérée en direct pour cette recherche. Précisez le nom de l'objet (marque, modèle) — l'estimation ci-dessous est volontairement prudente.");
    }
    else if (stats.sampleSize < 4) {
        warnings.push(isEn
            ? `Only ${stats.sampleSize} comparable(s) found — treat the range as a rough guide, the market is thin.`
            : `Seulement ${stats.sampleSize} annonce(s) comparable(s) trouvée(s) — la fourchette est à prendre comme une indication, le marché est étroit.`);
    }
    if (!aiAvailable) {
        warnings.push(isEn
            ? "AI vision is not configured on this deployment (missing API key). Identification relied on your input; prices remain 100% based on live web listings."
            : "La vision IA n'est pas configurée sur ce déploiement (clé API absente). L'identification repose sur votre saisie ; les prix restent 100 % issus d'annonces web en direct.");
    }
    warnings.push(isEn
        ? "Indicative estimate: prices depend on condition, timing, photos and platform fees. Always verify the linked listings yourself."
        : "Estimation indicative : les prix dépendent de l'état, du timing, des photos et des frais de plateforme. Vérifiez toujours les annonces liées par vous-même.");
    return warnings;
}
