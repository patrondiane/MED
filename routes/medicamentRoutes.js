// routes/medicamentRoutes.js

const express = require('express');
const rateLimit = require('express-rate-limit');
const { Medicament, Presentation } = require('../models/Medicament');
const { getStatutObsolescence } = require('../utils/statutMedicament');
const { getDocumentUrls, fetchDocumentSummary } = require('../utils/documentsBdpm');

const router = express.Router();

// Les documents sont récupérés en direct sur le site officiel : limite plus stricte.
const documentsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Trop de demandes de documents, réessayez dans une minute.' },
});

const withStatut = (medicament) => ({
    ...medicament,
    statut_obsolescence: getStatutObsolescence(medicament),
});

/** Échappe les caractères spéciaux pour utiliser la saisie utilisateur dans une regex MongoDB. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. Recherche par NOM (nom de spécialité ou substance déjà présente dans la dénomination)
router.get('/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();

    if (q.length < 2) {
        return res.status(400).json({ message: 'Le paramètre "q" doit contenir au moins 2 caractères.' });
    }
    if (q.length > 100) {
        return res.status(400).json({ message: 'Le paramètre "q" est trop long.' });
    }

    try {
        const medicaments = await Medicament.find({
            denomination: { $regex: escapeRegex(q), $options: 'i' },
        })
            .select('code_cis denomination forme_pharmaceutique statut_amm etat_commercialisation')
            .limit(60)
            .lean();

        // Ordre : 1) noms qui COMMENCENT par la saisie, 2) médicaments encore
        // commercialisés, 3) ordre alphabétique.
        const lower = q.toLowerCase();
        const resultats = medicaments.map(withStatut);
        resultats.sort((a, b) => {
            const aStarts = (a.denomination || '').toLowerCase().startsWith(lower) ? 0 : 1;
            const bStarts = (b.denomination || '').toLowerCase().startsWith(lower) ? 0 : 1;
            const aObsolete = a.statut_obsolescence.obsolete ? 1 : 0;
            const bObsolete = b.statut_obsolescence.obsolete ? 1 : 0;
            return aStarts - bStarts || aObsolete - bObsolete
                || (a.denomination || '').localeCompare(b.denomination || '', 'fr');
        });

        res.json(resultats.slice(0, 25));
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur pendant la recherche.' });
    }
});

// 2. Recherche par code-barres scanné (CIP13, ou CIP7) — conservée pour le scan caméra.
router.get('/scan/:codeBarre', async (req, res) => {
    const codeBarre = req.params.codeBarre.trim();

    if (!/^\d{7}$|^\d{13}$/.test(codeBarre)) {
        return res.status(400).json({ message: 'Code-barres invalide (CIP7 : 7 chiffres, CIP13 : 13 chiffres).' });
    }

    try {
        const presentation = await Presentation.findOne({
            $or: [{ code_cip13: codeBarre }, { code_cip7: codeBarre }],
        }).lean();

        if (!presentation) {
            return res.status(404).json({ message: `Aucune présentation trouvée pour le code-barres "${codeBarre}".` });
        }

        const medicament = await Medicament.findOne({ code_cis: presentation.code_cis }).lean();

        if (!medicament) {
            return res.status(404).json({
                message: `Code-barres reconnu mais aucun médicament associé (code CIS ${presentation.code_cis}).`,
            });
        }

        res.json({
            ...withStatut(medicament),
            presentation_scannee: presentation,
            documents: getDocumentUrls(medicament.code_cis),
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur pendant le scan.' });
    }
});

// 3. Détail d'un médicament par code CIS
router.get('/:cis', async (req, res) => {
    if (!/^\d{8}$/.test(req.params.cis)) {
        return res.status(400).json({ message: 'Code CIS invalide (8 chiffres attendus).' });
    }

    try {
        const medicament = await Medicament.findOne({ code_cis: req.params.cis })
            .populate('presentations')
            .populate('avis_smr')
            .populate('avis_asmr')
            .lean();

        if (!medicament) {
            return res.status(404).json({ message: 'Médicament non trouvé.' });
        }

        res.json({
            ...withStatut(medicament),
            documents: getDocumentUrls(medicament.code_cis),
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// 4. Rubriques clés du RCP et de la notice, récupérées sur le site officiel
router.get('/:cis/documents', documentsLimiter, async (req, res) => {
    const { cis } = req.params;

    if (!/^\d{8}$/.test(cis)) {
        return res.status(400).json({ message: 'Code CIS invalide (8 chiffres attendus).' });
    }

    const urls = getDocumentUrls(cis);

    const [rcp, notice] = await Promise.allSettled([
        fetchDocumentSummary(urls.rcp, 'rcp'),
        fetchDocumentSummary(urls.notice, 'notice'),
    ]);

    const format = (result, url) => (result.status === 'fulfilled'
        ? { url, ...result.value }
        : { url, sections: [], derniere_maj: null, erreur: result.reason.message });

    res.json({
        fiche_officielle: urls.fiche,
        rcp: format(rcp, urls.rcp_page),
        notice: format(notice, urls.rcp_page),
    });
});

// 5. Présentations d'un médicament
router.get('/:cis/presentations', async (req, res) => {
    if (!/^\d{8}$/.test(req.params.cis)) {
        return res.status(400).json({ message: 'Code CIS invalide (8 chiffres attendus).' });
    }

    try {
        const presentations = await Presentation.find({ code_cis: req.params.cis });
        res.json(presentations);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

module.exports = router;