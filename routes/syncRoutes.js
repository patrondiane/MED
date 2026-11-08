// routes/syncRoutes.js

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const BDM_FILES_DIR = path.join(__dirname, '..', 'scripts', 'BDM_FILES');

const readJsonSafe = (fileName) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(BDM_FILES_DIR, fileName), 'utf-8'));
    } catch (error) {
        return null; // fichier absent = aucune synchro n'a encore eu lieu
    }
};

// GET /api/v1/sync/status — informations sur le dernier téléchargement et le dernier import
router.get('/status', (req, res) => {
    const lastDownload = readJsonSafe('_last-download.json');
    const lastImport = readJsonSafe('_last-import.json');

    res.json({
        last_download: lastDownload,
        last_import: lastImport,
        source: 'https://base-donnees-publique.medicaments.gouv.fr/telechargement',
    });
});

module.exports = router;
