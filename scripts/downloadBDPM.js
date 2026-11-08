// scripts/downloadBDPM.js
//
// Télécharge automatiquement les fichiers sources depuis le site officiel
// (https://base-donnees-publique.medicaments.gouv.fr/telechargement) et les
// place dans scripts/BDM_FILES/, prêts pour importData.js.
//
// La base est mise à jour environ une fois par mois (le fichier des ruptures
// de stock plus souvent). Ce script peut être relancé à tout moment : il
// écrase simplement les fichiers existants avec la version la plus récente.

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://base-donnees-publique.medicaments.gouv.fr/download/file';
const OUTPUT_DIR = path.join(__dirname, 'BDM_FILES');

// Fichiers utilisés par importData.js. On garde aussi CIS_CIP_Dispo_Spec.txt
// (ruptures de stock) car il est directement utile pour distinguer un
// médicament "obsolète" d'un médicament simplement en tension d'approvisionnement.
const FILES = [
    'CIS_bdpm.txt',
    'CIS_CIP_bdpm.txt',
    'CIS_COMPO_bdpm.txt',
    'CIS_HAS_SMR_bdpm.txt',
    'CIS_HAS_ASMR_bdpm.txt',
    'CIS_CIP_Dispo_Spec.txt', // ruptures de stock — non importé par défaut, voir README
];

const downloadFile = async (fileName) => {
    const url = `${BASE_URL}/${fileName}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} en téléchargeant ${fileName}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
        throw new Error(`${fileName} téléchargé mais vide — le site a peut-être changé de format.`);
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buffer);
    return buffer.length;
};

const run = async () => {
    if (typeof fetch !== 'function') {
        console.error('❌ Ce script nécessite Node.js 18+ (pour l\'API fetch native).');
        process.exit(1);
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`⏳ Téléchargement de ${FILES.length} fichiers depuis base-donnees-publique.medicaments.gouv.fr...\n`);

    const results = { ok: [], failed: [] };

    for (const fileName of FILES) {
        try {
            const size = await downloadFile(fileName);
            console.log(`✅ ${fileName} (${(size / 1024).toFixed(0)} Ko)`);
            results.ok.push(fileName);
        } catch (error) {
            console.error(`❌ ${fileName} : ${error.message}`);
            results.failed.push(fileName);
        }
    }

    const summary = {
        downloaded_at: new Date().toISOString(),
        ok: results.ok,
        failed: results.failed,
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, '_last-download.json'), JSON.stringify(summary, null, 2));

    console.log(`\n${results.failed.length === 0 ? '🌟' : '⚠️'} ${results.ok.length}/${FILES.length} fichiers téléchargés.`);

    if (results.failed.length > 0) {
        console.log('Fichiers en échec :', results.failed.join(', '));
        process.exitCode = 1;
    }
};

run();
