// test/configMongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnostiquerMongoUri } = require('../utils/configMongo');

test('MONGO_URI vide → message qui explique où l’ajouter', () => {
    assert.match(diagnostiquerMongoUri(''), /vide ou absente/);
    assert.match(diagnostiquerMongoUri(undefined), /vide ou absente/);
    assert.match(diagnostiquerMongoUri('   '), /vide ou absente/);
});

test('guillemets, mauvais préfixe et mot de passe d’exemple sont détectés', () => {
    assert.match(diagnostiquerMongoUri('"mongodb+srv://u:p@h/db"'), /guillemets/);
    assert.match(diagnostiquerMongoUri('https://cluster.mongodb.net'), /doit commencer/);
    assert.match(diagnostiquerMongoUri('mongodb+srv://u:<db_password>@h/db'), /texte d’exemple/);
});

test('une chaîne valide est acceptée', () => {
    assert.equal(diagnostiquerMongoUri('mongodb+srv://utilisateur:secret@cluster0.exemple.mongodb.net/bdpm'), null);
    assert.equal(diagnostiquerMongoUri('mongodb://localhost:27017/bdpm'), null);
});
