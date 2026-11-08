// scripts/scheduler.js
//
// Lance scripts/sync.js automatiquement selon un planning cron. À utiliser
// comme process de fond long-running (ex: un service systemd, un container
// dédié, ou `pm2 start scripts/scheduler.js`).
//
// Alternative sans dépendance : configurer une tâche cron système qui
// exécute `node scripts/sync.js` directement (voir README).

const cron = require('node-cron');
const path = require('path');
const { execFileSync } = require('child_process');

// La BDPM est mise à jour environ une fois par mois ; le fichier des
// ruptures de stock plus souvent. Par défaut : tous les lundis à 3h du matin.
// Personnalisable via la variable d'environnement CRON_SCHEDULE (syntaxe cron standard).
const SCHEDULE = process.env.CRON_SCHEDULE || '0 3 * * 1';

const runSync = () => {
    console.log(`\n[${new Date().toISOString()}] Déclenchement de la synchronisation planifiée...`);
    try {
        execFileSync(process.execPath, [path.join(__dirname, 'sync.js')], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
        });
    } catch (error) {
        // sync.js a déjà loggé le détail ; on ne relance pas le process pour autant
        console.error('La synchronisation planifiée a échoué, nouvelle tentative au prochain créneau.');
    }
};

if (!cron.validate(SCHEDULE)) {
    console.error(`❌ Expression cron invalide : "${SCHEDULE}"`);
    process.exit(1);
}

console.log(`⏰ Planificateur BDPM démarré. Prochaines synchronisations selon : "${SCHEDULE}"`);
cron.schedule(SCHEDULE, runSync);

// Lance aussi une synchronisation immédiate au démarrage, utile après un déploiement.
runSync();
