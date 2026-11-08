// utils/statutMedicament.js
//
// Détermine si un médicament est "obsolète" (plus disponible / AMM non active)
// à partir des champs bruts de la BDPM (CIS_bdpm.txt).
//
// Champs utilisés :
//  - statut_amm            : ex. "Autorisation active", "Autorisation retirée",
//                             "Autorisation abrogée", "Autorisation suspendue"
//  - etat_commercialisation: ex. "Commercialisée", "Non commercialisée",
//                             "Déclaration de suspension de commercialisation
//                              (le médicament n'est plus commercialisé)",
//                             "Arrêt de commercialisation"
//
// Aucun de ces champs n'est un booléen strict dans le fichier source, donc on
// travaille par correspondance textuelle plutôt que par égalité exacte.
//
// Les textes sont NORMALISÉS avant comparaison (minuscules, accents retirés) :
// la décision ne dépend donc ni des accents ni de leur encodage. Le caractère
// de remplacement « � » est aussi toléré, pour que les données importées avant
// la correction de l'encodage (voir utils/encodage.js) restent bien classées
// jusqu'au prochain import.

/** "Commercialisée" → "commercialisee" ; "Commercialis�e" → "commercialis�e". */
const normaliser = (texte) => (texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const AMM_ACTIVE = /^autorisation active$/;
const COMMERCIALISEE = /^commercialis(?:e|�)e$/;

/**
 * @param {{ statut_amm?: string, etat_commercialisation?: string }} medicament
 * @returns {{ obsolete: boolean, code: 'commercialise' | 'amm_non_active' | 'retire', label: string, reason: string }}
 */
function getStatutObsolescence(medicament) {
    const statutAmm = (medicament.statut_amm || '').trim();
    const etatCommercialisation = (medicament.etat_commercialisation || '').trim();

    const ammActive = AMM_ACTIVE.test(normaliser(statutAmm));
    const surLeMarche = COMMERCIALISEE.test(normaliser(etatCommercialisation));

    if (ammActive && surLeMarche) {
        return {
            obsolete: false,
            code: 'commercialise',
            label: 'Toujours commercialisé',
            reason: 'L’autorisation de mise sur le marché est active et le médicament est déclaré commercialisé.',
        };
    }

    if (!ammActive) {
        return {
            obsolete: true,
            code: 'amm_non_active',
            label: 'AMM non active',
            reason: `Statut de l’autorisation de mise sur le marché : « ${statutAmm || 'inconnu'} ».`,
        };
    }

    return {
        obsolete: true,
        code: 'retire',
        label: 'Retiré du marché',
        reason: `L’autorisation est active, mais l’état de commercialisation indique : « ${etatCommercialisation || 'inconnu'} ».`,
    };
}

module.exports = { getStatutObsolescence, normaliser };
