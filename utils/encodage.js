// utils/encodage.js
//
// Les fichiers de la BDPM n'utilisent pas tous le même encodage :
//  - CIS_CIP_bdpm.txt est en UTF-8 ;
//  - CIS_bdpm.txt, CIS_COMPO_bdpm.txt, CIS_HAS_SMR_bdpm.txt, CIS_HAS_ASMR_bdpm.txt
//    et CIS_CIP_Dispo_Spec.txt sont en Windows-1252 (Latin-1 étendu).
//
// Les lire tous comme de l'UTF-8 remplace les lettres accentuées par « � »
// (ex. « Commercialis�e »), ce qui casse ensuite la détection du statut de
// commercialisation. On détecte donc l'encodage fichier par fichier.

const utf8Strict = new TextDecoder('utf-8', { fatal: true });

let windows1252;
try {
    windows1252 = new TextDecoder('windows-1252');
} catch {
    windows1252 = null; // Node compilé sans ICU complet : repli sur latin1 ci-dessous
}

/**
 * Décode le contenu brut d'un fichier BDPM en texte.
 * Essaie l'UTF-8 strict ; s'il échoue, le fichier est en Windows-1252.
 * @param {Buffer|Uint8Array} buffer
 * @returns {{ text: string, encoding: 'utf-8' | 'windows-1252' }}
 */
function decoderFichierBdpm(buffer) {
    let text;
    let encoding;
    try {
        text = utf8Strict.decode(buffer);
        encoding = 'utf-8';
    } catch {
        text = windows1252 ? windows1252.decode(buffer) : Buffer.from(buffer).toString('latin1');
        encoding = 'windows-1252';
    }
    // Retire l'éventuelle marque d'ordre des octets (BOM) en début de fichier.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { text, encoding };
}

module.exports = { decoderFichierBdpm };
