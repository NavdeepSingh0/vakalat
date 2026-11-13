const express = require('express');
const { HttpError } = require('../middleware/errorHandler');
const { isValidCnr, requireString } = require('../middleware/validate');
const { toPublicCase } = require('../services/serialize');
const logger = require('../services/logger');

/** CAPTCHA relay + live lookup. Each call reaches the real eCourts portal, so these are rate-limited. */
function createEcourtsRouter({ store, ecourts, limiter }) {
    const router = express.Router();

    // Step 1: fetch a CAPTCHA for the user to solve.
    router.get('/captcha', limiter, async (req, res) => {
        const courtType = typeof req.query.courtType === 'string' ? req.query.courtType : 'district';
        if (!['district', 'highcourt'].includes(courtType)) {
            throw new HttpError(400, 'invalid_court_type', 'courtType must be "district" or "highcourt".');
        }
        try {
            const result = await ecourts.fetchCaptcha(courtType);
            res.json({
                sessionId: result.sessionId, courtType: result.courtType, captchaDataUrl: result.captchaDataUrl,
                expiresIn: '10 minutes', hint: 'Solve the CAPTCHA and submit it with the CNR via POST /api/case/cnr/live',
            });
        } catch (err) {
            if (err instanceof HttpError) throw err;
            logger.warn({ courtType, reason: err.message }, 'captcha fetch failed');
            throw new HttpError(502, 'ecourts_unavailable', 'Could not fetch a CAPTCHA from eCourts right now.', {
                hint: 'eCourts may be unavailable, or it may be refusing requests from this server. The demo cases work without it.',
            });
        }
    });

    // Step 2: CNR + solved CAPTCHA → case data.
    router.post('/case/cnr/live', limiter, async (req, res) => {
        const body = req.body ?? {};
        const cnr = requireString(body.cnr, 'cnr', { max: 16 }).toUpperCase();
        const captcha = requireString(body.captcha, 'captcha', { max: 20 });
        const sessionId = requireString(body.sessionId, 'sessionId', { max: 80 });
        if (!isValidCnr(cnr)) {
            throw new HttpError(400, 'invalid_cnr', 'CNR must be 4 letters followed by 12 digits (16 characters).');
        }

        let result;
        try {
            result = await ecourts.searchByCNR(cnr, captcha, sessionId);
        } catch (_) {
            throw new HttpError(502, 'ecourts_unavailable', 'Could not reach eCourts right now. Please try again.');
        }
        if (!result.success) {
            const status = result.error === 'session_expired' ? 410 : 400;
            return res.status(status).json({ success: false, error: result.error, message: result.message });
        }

        await store.saveLiveCase(cnr, result.data);
        res.json({ source: 'ecourts_live', fresh: true, data: toPublicCase(result.data) });
    });

    return router;
}

module.exports = { createEcourtsRouter };
