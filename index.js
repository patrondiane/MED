// index.js

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Derrière le proxy d'un hébergeur (Render, Railway, Fly...), l'IP réelle du visiteur
// vient de X-Forwarded-For ; nécessaire pour que la limitation de débit soit correcte.
app.set('trust proxy', 1);

// CSP désactivée : la page utilise des scripts/styles inline, Google Fonts et html5-qrcode (unpkg).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Santé du service (utilisé par les hébergeurs pour vérifier que l'appli tourne)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// API publique : 120 requêtes/minute/IP
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Trop de requêtes, réessayez dans une minute.' },
}));

// Application web installable (PWA)
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
        }
        if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache'); // le service worker doit toujours se mettre à jour
        }
    },
}));

app.use('/api/v1/medicaments', require('./routes/medicamentRoutes'));
app.use('/api/v1/sync', require('./routes/syncRoutes'));

const start = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connecté à MongoDB avec succès !');
        app.listen(PORT, () => console.log(`🌍 Serveur en cours d'exécution sur le port ${PORT}`));
    } catch (err) {
        console.error('❌ Échec de la connexion à MongoDB :', err.message);
        process.exit(1);
    }
};

// Permet de réutiliser `app` dans des tests sans lancer le serveur.
if (require.main === module) start();

module.exports = app;