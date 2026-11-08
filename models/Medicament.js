// models/Medicament.js

const mongoose = require('mongoose');

const PresentationSchema = new mongoose.Schema({
    code_cip7: { type: String, required: true, index: true },
    libelle: String,
    statut_admin: String,
    etat_commercialisation: String,
    date_declaration_commercialisation: Date,
    code_cip13: { type: String, index: true }, // utilisé pour la recherche par scan de code-barres
    agrement_collectivites: String,
    taux_remboursement: [String], // peut y en avoir plusieurs
    prix_euro: Number,
    indications_remboursement: String,
    code_cis: { type: String, required: true, index: true }, // pour la recherche directe / le lien vers le médicament
}, { collection: 'presentations' });

const CompositionSchema = new mongoose.Schema({
    designation_element_pharm: String,
    code_substance: String,
    denomination_substance: String,
    dosage_substance: String,
    reference_dosage: String,
    nature_composant: String, // SA ou ST
    numero_liaison_sa_ft: String,
}, { _id: false });

// --- Schémas pour les avis HAS ---

const AvisSMRSchema = new mongoose.Schema({
    code_cis: { type: String, required: true, index: true },
    code_dossier_has: String,
    motif_evaluation: String,
    date_avis: Date, // format source : AAAAMMJJ
    valeur_smr: String,
    libelle_smr: String,
}, { collection: 'avis_smr' });

const AvisASMRSchema = new mongoose.Schema({
    code_cis: { type: String, required: true, index: true },
    code_dossier_has: String,
    motif_evaluation: String,
    date_avis: Date,
    valeur_asmr: String,
    libelle_asmr: String,
}, { collection: 'avis_asmr' });

const MedicamentSchema = new mongoose.Schema({
    // Champs de CIS_bdpm.txt
    code_cis: { type: String, required: true, unique: true },
    denomination: String,
    forme_pharmaceutique: String,
    voies_administration: [String],
    statut_amm: String,
    type_procedure_amm: String,
    etat_commercialisation: String,
    date_amm: Date,
    statut_bdm: String,
    num_autorisation_europeenne: String,
    titulaires: [String],
    surveillance_renforcee: String,

    // Composition intégrée directement pour simplifier l'accès
    composition: [CompositionSchema],

    // Références vers les collections liées
    presentations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Presentation' }],
    avis_smr: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AvisSMR' }],
    avis_asmr: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AvisASMR' }],
});

const Presentation = mongoose.model('Presentation', PresentationSchema);
const Medicament = mongoose.model('Medicament', MedicamentSchema);
const AvisSMR = mongoose.model('AvisSMR', AvisSMRSchema);
const AvisASMR = mongoose.model('AvisASMR', AvisASMRSchema);

module.exports = { Medicament, Presentation, AvisSMR, AvisASMR };
