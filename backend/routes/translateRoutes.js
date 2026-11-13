const express = require('express');
const ecourtsCodes = require('../data/ecourts-codes.json');
const { HttpError, } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/translate?code=NNFR → plain-English meaning of an eCourts purpose / stage code
router.get('/translate', (req, res) => {
    const raw = req.query.code;
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 40) {
        throw new HttpError(400, 'invalid_request', 'Provide a "code" query parameter.');
    }
    const code = raw.toUpperCase().trim();
    if (Object.hasOwn(ecourtsCodes.businessCodes, code)) return res.json({ code, type: 'business', ...ecourtsCodes.businessCodes[code] });
    if (Object.hasOwn(ecourtsCodes.stageCodes, code)) return res.json({ code, type: 'stage', ...ecourtsCodes.stageCodes[code] });
    throw new HttpError(404, 'unknown_code', `Unknown code: ${code}`, { suggestion: 'See GET /api/translate/all for every known code.' });
});

router.get('/translate/all', (req, res) => res.json(ecourtsCodes));

module.exports = router;
