// utils/documentsBdpm.js
//
// Récupère le RCP (Résumé des Caractéristiques du Produit) et la notice patient
// d'un médicament à partir de son code CIS, et en extrait les rubriques utiles
// (indications, posologie, contre-indications, effets indésirables...).
//
// ⚠️ Cette partie dépend de la structure HTML des pages officielles, que l'ANSM
// peut changer (la BDPM doit être remplacée par « Info Médicament » en janvier
// 2027). Le code est donc défensif : si l'extraction ne trouve rien, on renvoie
// quand même les liens officiels et l'appli affiche un message clair.

const SITE = 'https://base-donnees-publique.medicaments.gouv.fr';

/** URLs d'un médicament : page officielle actuelle + anciennes URLs de documents. */
const getDocumentUrls = (codeCis) => ({
    fiche: `${SITE}/medicament/${codeCis}/extrait`,
    rcp_page: `${SITE}/medicament/${codeCis}/extrait#tab-rcp-et-notice`,
    // Anciennes URLs « document » : utilisées pour récupérer le texte (suivent les redirections).
    rcp: `${SITE}/affichageDoc.php?specid=${codeCis}&typedoc=R`,
    notice: `${SITE}/affichageDoc.php?specid=${codeCis}&typedoc=N`,
});

// --- HTML -> texte --------------------------------------------------------

const NAMED_ENTITIES = {
    eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', auml: 'ä',
    iuml: 'ï', icirc: 'î', ouml: 'ö', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', uuml: 'ü',
    ccedil: 'ç', oelig: 'œ', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç',
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»',
    ndash: '–', mdash: '—', hellip: '…', deg: '°', micro: 'µ',
};

const decodeEntities = (text) => text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);

const htmlToPlainText = (html) => {
    const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');

    return decodeEntities(cleaned)
        .replace(/[ \t\u00a0]+/g, ' ')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
};

// --- Extraction de rubriques ---------------------------------------------

const RCP_SECTIONS = [
    { titre: 'Indications thérapeutiques', start: /^4\.1\.?\s*indications?\s+th[ée]rapeutiques/i },
    { titre: 'Posologie et mode d’administration', start: /^4\.2\.?\s*posologie/i },
    { titre: 'Contre-indications', start: /^4\.3\.?\s*contre-?\s?indications?/i },
    { titre: 'Mises en garde et précautions d’emploi', start: /^4\.4\.?\s*mises?\s+en\s+garde/i },
    { titre: 'Grossesse et allaitement', start: /^4\.6\.?\s*(fertilit[ée]|grossesse)/i },
    { titre: 'Effets indésirables', start: /^4\.8\.?\s*effets?\s+ind[ée]sirables?/i },
];

const NOTICE_SECTIONS = [
    { titre: 'À quoi sert ce médicament ?', start: /^(1\.?\s*)?qu.?est-ce\s+que/i },
    { titre: 'Avant de le prendre', start: /^(2\.?\s*)?quelles\s+sont\s+les\s+informations/i },
    { titre: 'Comment le prendre ?', start: /^(3\.?\s*)?comment\s+(prendre|utiliser|administrer)/i },
    { titre: 'Effets indésirables', start: /^(4\.?\s*)?quels\s+sont\s+les\s+effets/i },
    { titre: 'Conservation', start: /^(5\.?\s*)?comment\s+conserver/i },
];

// Fin d'une rubrique : n'importe quel titre numéroté (RCP : "4.3 Contre", "5. PROPRIÉTÉS")
// ou n'importe quel début de rubrique connu de la notice.
const GENERIC_RCP_HEADING = /^\d{1,2}(\.\d{1,2})*\.?\s+[A-ZÉÈÀÂÎÔÙ]/;
const NOTICE_HEADING = /^(\d\.?\s*)?(qu.?est-ce\s+que|quelles\s+sont|comment\s+(prendre|utiliser|administrer|conserver)|quels\s+sont|contenu\s+de\s+l)/i;

const truncate = (text, max) => {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).trim() + '…';
};

/**
 * Extrait les rubriques voulues. Le sommaire de la page contient aussi les titres,
 * donc pour chaque rubrique on garde l'occurrence dont le contenu est le plus long.
 */
const extractSections = (text, definitions, isHeading, maxPerSection = 700) => {
    const lines = text.split('\n');
    const sections = [];

    for (const def of definitions) {
        let best = '';
        lines.forEach((line, i) => {
            if (!def.start.test(line)) return;
            const body = [];
            for (let j = i + 1; j < lines.length && j < i + 400; j++) {
                if (isHeading(lines[j])) break;
                body.push(lines[j]);
            }
            const joined = body.join('\n').trim();
            if (joined.length > best.length) best = joined;
        });
        if (best.length > 20) sections.push({ titre: def.titre, texte: truncate(best, maxPerSection) });
    }
    return sections;
};

// --- Récupération --------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

const cacheGet = (key) => {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
    return hit.value;
};
const cacheSet = (key, value) => {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value });
};

/**
 * @param {string} url
 * @param {'rcp'|'notice'} type
 */
const fetchDocumentSummary = async (url, type) => {
    const cached = cacheGet(url);
    if (cached) return cached;

    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VerifMedicamentApp/1.0)' },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Document indisponible (HTTP ${response.status}).`);

    const text = htmlToPlainText(await response.text());
    const sections = type === 'rcp'
        ? extractSections(text, RCP_SECTIONS, (l) => GENERIC_RCP_HEADING.test(l))
        : extractSections(text, NOTICE_SECTIONS, (l) => NOTICE_HEADING.test(l));

    const dateMatch = text.match(/Mis à jour le\s*:?\s*([\d/]+)/i);
    const value = { sections, derniere_maj: dateMatch ? dateMatch[1] : null };

    // On ne met en cache que les extractions réussies, pour retenter les autres.
    if (sections.length > 0) cacheSet(url, value);
    return value;
};

module.exports = {
    getDocumentUrls, fetchDocumentSummary,
    // exportés pour les tests
    htmlToPlainText, extractSections, RCP_SECTIONS, NOTICE_SECTIONS, GENERIC_RCP_HEADING, NOTICE_HEADING,
};