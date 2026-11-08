# Vérif Médicament

Application web installable qui indique si un médicament est **toujours commercialisé en France**, à partir de la **Base de données publique des médicaments (BDPM)** : recherche par nom ou scan du code-barres de la boîte, statut d'autorisation, composition, présentations, et extraits du RCP et de la notice.

> Les informations sont données à titre indicatif et ne remplacent pas l'avis d'un médecin ou d'un pharmacien. La source et la date de mise à jour des données sont affichées sur chaque page, conformément aux conditions de réutilisation de la BDPM.

## Fonctionnement

| Élément | Rôle |
|---|---|
| `index.js` | Serveur Express : API, page web, sécurité (Helmet, limitation de débit) |
| `routes/medicamentRoutes.js` | API `/api/v1/medicaments` (recherche, fiche, scan, documents) |
| `routes/syncRoutes.js` | API `/api/v1/sync/status` (date de la dernière mise à jour) |
| `utils/statutMedicament.js` | Calcul du statut : commercialisé, retiré du marché, AMM non active |
| `utils/encodage.js` | Lecture des fichiers BDPM, qui mélangent UTF-8 et Windows-1252 |
| `utils/documentsBdpm.js` | Extraction des rubriques du RCP et de la notice sur le site officiel |
| `scripts/` | Téléchargement et import des fichiers officiels dans MongoDB |
| `public/` | Page web et fichiers de l'application installable |
| `test/` | Tests automatiques (`npm test`) |

### API

| Route | Réponse |
|---|---|
| `GET /api/v1/medicaments/search?q=<nom>` | Jusqu'à 25 médicaments, avec leur statut |
| `GET /api/v1/medicaments/<code CIS>` | Fiche complète : composition, présentations, avis HAS |
| `GET /api/v1/medicaments/scan/<CIP13 ou CIP7>` | Médicament correspondant à un code-barres |
| `GET /api/v1/medicaments/<code CIS>/documents` | Lien officiel et extraits du RCP et de la notice |
| `GET /api/v1/sync/status` | Date et bilan de la dernière synchronisation |
| `GET /health` | État du service |

## Installation locale

```bash
npm install
cp .env.example .env      # puis renseigner MONGO_URI
npm run bdpm:sync         # télécharge les fichiers officiels puis les importe
npm start                 # http://localhost:3000
npm test                  # tests automatiques
```

## Sécurité des identifiants

- Le fichier `.env` contient le mot de passe de la base : il est exclu de Git par `.gitignore` et **ne doit jamais être publié**.
- Chez l'hébergeur (Render) et dans GitHub Actions, le mot de passe est saisi comme **variable d'environnement** ou **secret** (`MONGO_URI`), jamais dans le code.
- Dans MongoDB Atlas, utilisez un utilisateur dédié à l'application, avec un mot de passe long et aléatoire.

## Mise en ligne

1. **Base de données** : cluster gratuit MongoDB Atlas ; autoriser l'adresse IP de l'hébergeur dans *Network Access*.
2. **Hébergement** (Render, Railway, Fly.io…) : déploiement depuis ce dépôt avec le `dockerfile` fourni, ou en Node avec la commande `node index.js` ; variable `MONGO_URI` ; contrôle de santé sur `/health`. Le HTTPS est indispensable pour la caméra et l'installation de l'application.
3. **Mise à jour des données** : le workflow `.github/workflows/manual.yml` exécute `npm run bdpm:sync` chaque lundi à 3 h et peut être lancé à la main (onglet *Actions* → *Sync BDPM* → *Run workflow*). Il utilise le secret de dépôt `MONGO_URI`.

## Installer l'application sur téléphone

- **Android (Chrome)** : bouton « Installer » dans la page, ou menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : *Partager* → *Sur l'écran d'accueil*.

## À surveiller : la BDPM devient « Info Médicament » en janvier 2027

L'ANSM annonce le remplacement de la BDPM par Info Médicament, avec redirection des anciens liens et publication des données sur data.gouv.fr. Il faudra alors adapter `BASE_URL` dans `scripts/downloadBDPM.js` et `getDocumentUrls` dans `utils/documentsBdpm.js`. En attendant, l'application continue de fonctionner avec les dernières données importées.
