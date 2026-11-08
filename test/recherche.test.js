// test/recherche.test.js
// Appelle la vraie route GET /api/v1/medicaments/search, en remplaçant seulement
// l'accès à MongoDB par des données fictives (aucune base nécessaire).

const test = require('node:test');
const assert = require('node:assert/strict');

const { Medicament } = require('../models/Medicament');
const app = require('../index');

const FICTIFS = [
    { code_cis: '1', denomination: 'DOLIPRANE 100 mg, sachet', statut_amm: 'Autorisation abrogée', etat_commercialisation: 'Non commercialisée' },
    { code_cis: '2', denomination: 'DOLIPRANE 1000 mg, comprimé', statut_amm: 'Autorisation active', etat_commercialisation: 'Commercialisée' },
    { code_cis: '3', denomination: 'PARACETAMOL DOLI, gélule', statut_amm: 'Autorisation active', etat_commercialisation: 'Commercialisée' },
    { code_cis: '4', denomination: 'DOLIPRANE 500 mg, gélule', statut_amm: 'Autorisation active', etat_commercialisation: 'Commercialis�e' },
];

test('la recherche classe d’abord les noms commençant par la saisie, puis les médicaments commercialisés', async (t) => {
    const original = Medicament.find;
    Medicament.find = () => ({ select: () => ({ limit: () => ({ lean: async () => FICTIFS.map((m) => ({ ...m })) }) }) });
    t.after(() => { Medicament.find = original; });

    const server = app.listen(0);
    t.after(() => server.close());
    const { port } = server.address();

    const res = await fetch(`http://127.0.0.1:${port}/api/v1/medicaments/search?q=doli`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.deepEqual(data.map((m) => m.code_cis), ['2', '4', '1', '3']);
    assert.equal(data[0].statut_obsolescence.code, 'commercialise');
    assert.equal(data[1].statut_obsolescence.code, 'commercialise', 'donnée à l’ancien encodage bien classée');
    assert.equal(data[2].statut_obsolescence.code, 'amm_non_active');
});

test('une saisie trop courte est refusée avec un message clair', async (t) => {
    const server = app.listen(0);
    t.after(() => server.close());
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/medicaments/search?q=d`);
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /au moins 2 caractères/);
});
