// test/statut-et-encodage.test.js
// Lancement : npm test   (utilise le lanceur de tests intégré à Node.js)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { decoderFichierBdpm } = require('../utils/encodage');
const { getStatutObsolescence } = require('../utils/statutMedicament');

// --- Encodage -------------------------------------------------------------

test('un texte Windows-1252 est décodé avec ses accents', () => {
    // « Commercialisée » en Windows-1252 : é = octet 0xE9
    const buffer = Buffer.from([...Buffer.from('Commercialis', 'ascii'), 0xe9, 0x65]);
    const { text, encoding } = decoderFichierBdpm(buffer);
    assert.equal(encoding, 'windows-1252');
    assert.equal(text, 'Commercialisée');
});

test('un texte UTF-8 est laissé tel quel', () => {
    const { text, encoding } = decoderFichierBdpm(Buffer.from('Présentation active', 'utf-8'));
    assert.equal(encoding, 'utf-8');
    assert.equal(text, 'Présentation active');
});

test('la marque BOM éventuelle est retirée', () => {
    const { text } = decoderFichierBdpm(Buffer.from('﻿CIS', 'utf-8'));
    assert.equal(text, 'CIS');
});

test('les fichiers BDPM du dépôt sont décodés sans caractère de remplacement', { skip: !fs.existsSync(path.join(__dirname, '..', 'scripts', 'BDM_FILES', 'CIS_bdpm.txt')) }, () => {
    const dossier = path.join(__dirname, '..', 'scripts', 'BDM_FILES');
    for (const fichier of fs.readdirSync(dossier).filter((f) => f.endsWith('.txt'))) {
        const { text } = decoderFichierBdpm(fs.readFileSync(path.join(dossier, fichier)));
        assert.ok(!text.includes('�'), `${fichier} contient encore « � » après décodage`);
    }
});

// --- Statut -----------------------------------------------------------------

test('AMM active + commercialisée → toujours commercialisé', () => {
    const s = getStatutObsolescence({ statut_amm: 'Autorisation active', etat_commercialisation: 'Commercialisée' });
    assert.equal(s.obsolete, false);
    assert.equal(s.code, 'commercialise');
});

test('donnée importée avant correction (« Commercialis�e ») → reste bien commercialisé', () => {
    const s = getStatutObsolescence({ statut_amm: 'Autorisation active', etat_commercialisation: 'Commercialis�e' });
    assert.equal(s.obsolete, false);
});

test('AMM active + non commercialisée → retiré du marché', () => {
    const s = getStatutObsolescence({ statut_amm: 'Autorisation active', etat_commercialisation: 'Non commercialisée' });
    assert.equal(s.obsolete, true);
    assert.equal(s.code, 'retire');
});

for (const statut of ['Autorisation abrogée', 'Autorisation archivée', 'Autorisation retirée', 'Autorisation suspendue']) {
    test(`${statut} → AMM non active`, () => {
        const s = getStatutObsolescence({ statut_amm: statut, etat_commercialisation: 'Commercialisée' });
        assert.equal(s.obsolete, true);
        assert.equal(s.code, 'amm_non_active');
    });
}

test('champs vides → jamais déclaré commercialisé', () => {
    assert.equal(getStatutObsolescence({}).obsolete, true);
});
