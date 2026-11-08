# Mettre l'appli à disposition de tous (site + application installable)

## 1. Base de données en ligne (MongoDB Atlas, offre gratuite)
1. Crée un cluster gratuit sur https://www.mongodb.com/atlas, puis un utilisateur de base de données.
2. Dans « Network Access », autorise l'IP de ton hébergeur (ou 0.0.0.0/0 si tu ne la connais pas — mot de passe fort obligatoire).
3. Copie la chaîne de connexion dans ton `.env` : `MONGO_URI=mongodb+srv://...`

## 2. Charger les données une première fois (depuis ton PC)
```bash
npm install
npm run bdpm:sync     # télécharge les fichiers officiels puis les importe dans Atlas
```

## 3. Héberger l'appli (Render, Railway, Fly.io…)
- Déploie ce dossier depuis un dépôt Git (le `Dockerfile` est fourni) ou en « Node » : commande de démarrage `node index.js`.
- Variable d'environnement à définir chez l'hébergeur : `MONGO_URI`.
- Chemin de contrôle de santé : `/health`.
- L'hébergeur fournit le HTTPS : **il est obligatoire** pour que la caméra (scan) et l'installation de l'application fonctionnent.

## 4. Mises à jour automatiques des données
Les données changent environ chaque mois. Le plus simple : une tâche planifiée GitHub Actions
(`.github/workflows/sync.yml`, avec le secret `MONGO_URI` dans les paramètres du dépôt) :
```yaml
name: Sync BDPM
on:
  schedule: [{ cron: "0 3 * * 1" }]
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install
      - run: npm run bdpm:sync
        env: { MONGO_URI: "${{ secrets.MONGO_URI }}" }
```
(Alternative : `npm run bdpm:scheduler` comme service de fond.) Note : sur un hébergeur à disque éphémère, la mention
« Données à jour au… » en bas de page n'apparaît que si la synchro a tourné sur le même serveur.

## 5. L'appli sur téléphone
- **Android (Chrome)** : bouton « Installer » affiché dans la page, ou menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ».
- Pour publier sur Google Play / l'App Store il faudra envelopper le site (TWA ou Capacitor) : possible plus tard, le site installable suffit pour commencer.

## 6. ⚠️ À surveiller : la BDPM est remplacée en janvier 2027
D'après l'ANSM (comité d'interface, oct. 2026), la BDPM devient « Info Médicament » en janvier 2027 : redirections automatiques
des anciens liens, et données structurées publiées sur data.gouv.fr. Il faudra alors adapter :
- `scripts/downloadBDPM.js` (`BASE_URL` des fichiers) ;
- `utils/documentsBdpm.js` (`getDocumentUrls`, et peut-être l'extraction du texte RCP/notice).
Tant que ces deux points échouent, l'appli continue de fonctionner avec les dernières données importées et affiche les liens officiels.