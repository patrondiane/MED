// scripts/importData.js

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const mongoose = require('mongoose');
require('dotenv').config();

const { Medicament, Presentation, AvisSMR, AvisASMR } = require('../models/Medicament');

const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connecté à MongoDB pour l\'importation.');
};

/**
 * Lit un fichier TXT tab-séparé et retourne les données.
 */
const parseFile = (filePath, columns) => {
    return new Promise((resolve, reject) => {
        const parser = parse({
            delimiter: '\t',
            relax_column_count: true,
            columns: columns,
            skip_empty_lines: true,
            from_line: 1,
            quote: false, // les fichiers BDPM n'échappent pas les guillemets
        });

        const data = [];
        fs.createReadStream(filePath)
            .pipe(parser)
            .on('data', (row) => data.push(row))
            .on('end', () => resolve(data))
            .on('error', (err) => reject(err));
    });
};

// --- Petits utilitaires défensifs : les fichiers BDPM ont souvent des champs vides,
//     donc on ne peut jamais supposer qu'une valeur existe avant de la découper. ---

/** Découpe une valeur "a;b;c" en tableau propre, ou tableau vide si absente. */
const splitList = (value) => (value ? value.split(';').map((v) => v.trim()).filter(Boolean) : []);

/** Trim sûr, retourne '' si la valeur est absente/undefined. */
const safeTrim = (value) => (value ? value.trim() : '');

/** Convertit une date JJ/MM/AAAA en objet Date, ou null si absente/invalide. */
const parseDateFrJJMMAAAA = (value) => {
    if (!value || !value.trim()) return null;
    const parts = value.trim().split('/');
    if (parts.length !== 3) return null;
    const iso = parts.reverse().join('-');
    const date = new Date(iso);
    return isNaN(date.getTime()) ? null : date;
};

/** Convertit une date AAAAMMJJ en objet Date, ou null si absente/invalide. */
const parseDateAAAAMMJJ = (value) => {
    if (!value || !/^\d{8}$/.test(value.trim())) return null;
    const formatted = value.trim().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const date = new Date(formatted);
    return isNaN(date.getTime()) ? null : date;
};

/** Parse un prix "12,34" (virgule décimale FR) en nombre, ou null si absent/invalide. */
const parsePrixEuro = (value) => {
    if (!value || !value.trim()) return null;
    const parsed = parseFloat(value.trim().replace(',', '.'));
    return isNaN(parsed) ? null : parsed;
};

/**
 * Importe les données des spécialités (CIS_bdpm.txt)
 */
const importSpecialites = async () => {
    console.log('⏳ Importation des spécialités...');
    const columns = [
        'code_cis', 'denomination', 'forme_pharmaceutique', 'voies_administration',
        'statut_amm', 'type_procedure_amm', 'etat_commercialisation', 'date_amm',
        'statut_bdm', 'num_autorisation_europeenne', 'titulaires', 'surveillance_renforcee',
    ];

    try {
        const data = await parseFile(path.join(__dirname, 'BDM_FILES', 'CIS_bdpm.txt'), columns);

        const preparedData = data
            .filter((item) => safeTrim(item.code_cis))
            .map((item) => ({
                code_cis: safeTrim(item.code_cis),
                denomination: item.denomination,
                forme_pharmaceutique: item.forme_pharmaceutique,
                voies_administration: splitList(item.voies_administration),
                statut_amm: item.statut_amm,
                type_procedure_amm: item.type_procedure_amm,
                etat_commercialisation: item.etat_commercialisation,
                date_amm: parseDateFrJJMMAAAA(item.date_amm),
                statut_bdm: item.statut_bdm,
                num_autorisation_europeenne: item.num_autorisation_europeenne,
                titulaires: splitList(item.titulaires),
                surveillance_renforcee: item.surveillance_renforcee,
            }));

        await Medicament.deleteMany({});
        await Medicament.insertMany(preparedData);
        console.log(`✅ ${preparedData.length} spécialités importées.`);
    } catch (error) {
        console.error('Erreur lors de l\'importation des spécialités :', error);
        throw error;
    }
};

/**
 * Importe les données des compositions (CIS_COMPO_bdpm.txt) et les intègre
 * dans les documents de la collection 'medicaments'.
 */
const importCompositions = async () => {
    console.log('⏳ Importation et intégration des compositions...');
    const columns = [
        'code_cis', 'designation_element_pharm', 'code_substance', 'denomination_substance',
        'dosage_substance', 'reference_dosage', 'nature_composant', 'numero_liaison_sa_ft',
    ];

    try {
        const data = await parseFile(path.join(__dirname, 'BDM_FILES', 'CIS_COMPO_bdpm.txt'), columns);

        const compositionsByCis = data.reduce((acc, item) => {
            const code_cis = safeTrim(item.code_cis);
            if (!code_cis) return acc;

            const compositionItem = {
                designation_element_pharm: item.designation_element_pharm,
                code_substance: item.code_substance,
                denomination_substance: item.denomination_substance,
                dosage_substance: item.dosage_substance,
                reference_dosage: item.reference_dosage,
                nature_composant: item.nature_composant,
                numero_liaison_sa_ft: item.numero_liaison_sa_ft,
            };

            if (!acc[code_cis]) acc[code_cis] = [];
            acc[code_cis].push(compositionItem);
            return acc;
        }, {});

        const operations = Object.entries(compositionsByCis).map(([code_cis, compositions]) => ({
            updateOne: {
                filter: { code_cis },
                update: { $set: { composition: compositions } },
            },
        }));

        if (operations.length > 0) {
            const result = await Medicament.bulkWrite(operations);
            console.log(`✅ ${result.modifiedCount} spécialités mises à jour avec la composition.`);
        } else {
            console.log('Aucune composition à importer.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'importation des compositions :', error);
        throw error;
    }
};

/**
 * Importe un fichier d'avis HAS (SMR ou ASMR) et lie les IDs créés au document Medicament.
 * Factorisé car importAvisSMR et importAvisASMR ne différaient que par le modèle et les colonnes.
 */
const importAvisHAS = async ({ label, fileName, columns, Model, linkField, dateField, valueFields }) => {
    console.log(`⏳ Importation des avis ${label}...`);

    try {
        const data = await parseFile(path.join(__dirname, 'BDM_FILES', fileName), columns);

        await Model.deleteMany({});

        const avisDocs = data
            .filter((item) => safeTrim(item.code_cis))
            .map((item) => ({
                ...item,
                code_cis: safeTrim(item.code_cis),
                date_avis: parseDateAAAAMMJJ(item[dateField]),
            }));

        const insertedAvis = await Model.insertMany(avisDocs);

        const idsByCis = insertedAvis.reduce((acc, doc) => {
            if (!acc[doc.code_cis]) acc[doc.code_cis] = [];
            acc[doc.code_cis].push(doc._id);
            return acc;
        }, {});

        const updateOperations = Object.entries(idsByCis).map(([code_cis, ids]) => ({
            updateOne: {
                filter: { code_cis },
                update: { $set: { [linkField]: ids } },
            },
        }));

        if (updateOperations.length > 0) {
            const result = await Medicament.bulkWrite(updateOperations);
            console.log(`✅ ${result.modifiedCount} spécialités liées aux avis ${label}.`);
        }

        console.log(`Total de ${insertedAvis.length} avis ${label} importés.`);
    } catch (error) {
        console.error(`Erreur lors de l'importation des avis ${label} :`, error);
        throw error;
    }
};

const importAvisSMR = () => importAvisHAS({
    label: 'SMR',
    fileName: 'CIS_HAS_SMR_bdpm.txt',
    columns: ['code_cis', 'code_dossier_has', 'motif_evaluation', 'date_avis', 'valeur_smr', 'libelle_smr'],
    Model: AvisSMR,
    linkField: 'avis_smr',
    dateField: 'date_avis',
});

const importAvisASMR = () => importAvisHAS({
    label: 'ASMR',
    fileName: 'CIS_HAS_ASMR_bdpm.txt',
    columns: ['code_cis', 'code_dossier_has', 'motif_evaluation', 'date_avis', 'valeur_asmr', 'libelle_asmr'],
    Model: AvisASMR,
    linkField: 'avis_asmr',
    dateField: 'date_avis',
});

/**
 * Importe les présentations (CIS_CIP_bdpm.txt) — contient les codes-barres CIP13
 * utilisés pour la recherche par scan — et les lie aux spécialités.
 */
const importPresentations = async () => {
    console.log('⏳ Importation des présentations (CIP) et liaison...');
    const columns = [
        'code_cis', 'code_cip7', 'libelle', 'statut_admin',
        'etat_commercialisation', 'date_declaration_commercialisation', 'code_cip13',
        'agrement_collectivites', 'taux_remboursement', 'prix_euro', 'indications_remboursement',
    ];

    try {
        const data = await parseFile(path.join(__dirname, 'BDM_FILES', 'CIS_CIP_bdpm.txt'), columns);

        await Presentation.deleteMany({});

        const presentationDocs = data
            .filter((item) => safeTrim(item.code_cis))
            .map((item) => ({
                code_cis: safeTrim(item.code_cis),
                code_cip7: safeTrim(item.code_cip7),
                libelle: item.libelle,
                statut_admin: item.statut_admin,
                etat_commercialisation: item.etat_commercialisation,
                date_declaration_commercialisation: parseDateFrJJMMAAAA(item.date_declaration_commercialisation),
                code_cip13: safeTrim(item.code_cip13),
                agrement_collectivites: item.agrement_collectivites,
                taux_remboursement: splitList(item.taux_remboursement),
                prix_euro: parsePrixEuro(item.prix_euro),
                indications_remboursement: item.indications_remboursement,
            }));

        const insertedPresentations = await Presentation.insertMany(presentationDocs);

        const presentationIdsByCis = insertedPresentations.reduce((acc, doc) => {
            if (!acc[doc.code_cis]) acc[doc.code_cis] = [];
            acc[doc.code_cis].push(doc._id);
            return acc;
        }, {});

        const updateOperations = Object.entries(presentationIdsByCis).map(([code_cis, ids]) => ({
            updateOne: {
                filter: { code_cis },
                update: { $set: { presentations: ids } },
            },
        }));

        if (updateOperations.length > 0) {
            const result = await Medicament.bulkWrite(updateOperations);
            console.log(`✅ ${result.modifiedCount} spécialités liées aux présentations.`);
        }

        console.log(`Total de ${insertedPresentations.length} présentations importées.`);
    } catch (error) {
        console.error('Erreur lors de l\'importation des présentations :', error);
        throw error;
    }
};

/** Écrit un résumé de l'import (compteurs + horodatage) pour consultation via l'API. */
const writeImportSummary = async (extra = {}) => {
    const summary = {
        imported_at: new Date().toISOString(),
        counts: {
            medicaments: await Medicament.countDocuments(),
            presentations: await Presentation.countDocuments(),
            avis_smr: await AvisSMR.countDocuments(),
            avis_asmr: await AvisASMR.countDocuments(),
        },
        ...extra,
    };
    fs.writeFileSync(path.join(__dirname, 'BDM_FILES', '_last-import.json'), JSON.stringify(summary, null, 2));
};

const runImport = async () => {
    try {
        await connectDB();

        await importSpecialites();       // 1. crée les documents principaux
        await importCompositions();      // 2. intègre la composition
        await importPresentations();     // 3. crée les présentations + lie les codes-barres CIP13
        await importAvisSMR();           // 4. avis SMR
        await importAvisASMR();          // 5. avis ASMR

        await writeImportSummary({ success: true });
        console.log('\n🌟 Importation des données terminée !');
    } catch (error) {
        console.error('Une erreur fatale est survenue durant l\'importation :', error);
        await writeImportSummary({ success: false, error: error.message }).catch(() => {});
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
};

runImport();
