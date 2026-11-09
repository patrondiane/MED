// scripts/sync.js
//
// Enchaîne le téléchargement des fichiers officiels puis leur import en base.
// C'est la commande à utiliser en manuel (`npm run bdpm:sync`) ou depuis le
// planificateur (`scripts/scheduler.js`).

const path = require('path');
const { execFileSync } = require('child_process');
const { diagnostiquerMongoUri } = require('../utils/configMongo');

const run = (scriptPath) => {
    execFileSync(process.execPath, [scriptPath], {
        stdio: 'inherit', // affiche les logs du sous-script en direct
        cwd: path.join(__dirname, '..'),
    });
};

const main = () => {
    const startedAt = Date.now();
    console.log('=== Synchronisation BDPM ===\n');

    // Vérification avant de télécharger quoi que ce soit : inutile de récupérer
    // 19 Mo de fichiers si l'import ne pourra pas se connecter à la base.
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    const probleme = diagnostiquerMongoUri(process.env.MONGO_URI);
    if (probleme) {
        console.error(`❌ Configuration incomplète : ${probleme}`);
        process.exitCode = 1;
        return;
    }

    try {
        run(path.join(__dirname, 'downloadBDPM.js'));
        console.log('');
        run(path.join(__dirname, 'importData.js'));

        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`\n✅ Synchronisation terminée en ${seconds}s.`);
    } catch (error) {
        // downloadBDPM.js / importData.js ont déjà loggé le détail de l'erreur
        console.error('\n❌ La synchronisation a échoué.');
        process.exitCode = 1;
    }
};

main();
