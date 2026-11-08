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

const AMM_ACTIVE = /autorisation active/i;
const COMMERCIALISEE = /^commercialis[ée]e$/i;

/**
 * @param {{ statut_amm?: string, etat_commercialisation?: string }} medicament
 * @returns {{ obsolete: boolean, label: string, reason: string }}
 */
function getStatutObsolescence(medicament) {
    const statutAmm = (medicament.statut_amm || '').trim();
    const etatCommercialisation = (medicament.etat_commercialisation || '').trim();

    const ammActive = AMM_ACTIVE.test(statutAmm);
    const surLeMarche = COMMERCIALISEE.test(etatCommercialisation);

    if (ammActive && surLeMarche) {
        return {
            obsolete: false,
            label: 'Toujours commercialisé',
            reason: `AMM active et statut de commercialisation : "${etatCommercialisation}".`,
        };
    }

    if (!ammActive) {
        return {
            obsolete: true,
            label: 'AMM non active',
            reason: `Statut de l'autorisation de mise sur le marché : "${statutAmm || 'inconnu'}".`,
        };
    }

    return {
        obsolete: true,
        label: 'Retiré du marché',
        reason: `AMM active mais statut de commercialisation : "${etatCommercialisation || 'inconnu'}".`,
    };
}

module.exports = { getStatutObsolescence };
