// utils/configMongo.js
//
// Vérifie la variable MONGO_URI AVANT toute opération, pour remplacer l'erreur
// technique de MongoDB (« Invalid scheme… ») par un message qui dit quoi faire.
// La valeur elle-même n'est jamais affichée : elle contient le mot de passe.

/**
 * @param {string | undefined} uri  valeur de process.env.MONGO_URI
 * @returns {string | null}  null si la valeur est utilisable, sinon le message d'erreur
 */
function diagnostiquerMongoUri(uri) {
    const valeur = (uri || '').trim();
    const ou = process.env.GITHUB_ACTIONS
        ? 'Dans GitHub : Settings → Secrets and variables → Actions → onglet « Secrets » → New repository secret, nom exact MONGO_URI.'
        : 'Ajoutez MONGO_URI dans le fichier .env (voir .env.example) ou dans les variables d’environnement de l’hébergeur.';

    if (!valeur) {
        return `MONGO_URI est vide ou absente. ${ou}`;
    }
    if (/^["']|["']$/.test(valeur)) {
        return 'MONGO_URI est entourée de guillemets : collez la chaîne sans guillemets.';
    }
    if (!/^mongodb(\+srv)?:\/\//.test(valeur)) {
        return 'MONGO_URI doit commencer par « mongodb+srv:// » ou « mongodb:// ». Copiez la chaîne complète depuis MongoDB Atlas (Connect → Drivers).';
    }
    if (/<password>|<db_password>|MOT_DE_PASSE/i.test(valeur)) {
        return 'MONGO_URI contient encore le texte d’exemple à la place du mot de passe : remplacez-le par le vrai mot de passe.';
    }
    return null;
}

module.exports = { diagnostiquerMongoUri };
