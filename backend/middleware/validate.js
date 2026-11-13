const { HttpError } = require('./errorHandler');

// 4-letter state+district code, 2-digit establishment, 6-digit case number, 4-digit year.
// eCourts CNRs use letters then digits, e.g. MHNA010000012019.
const CNR_RE = /^[A-Z]{4}\d{12}$/;

function isValidCnr(value) {
    return typeof value === 'string' && CNR_RE.test(value.trim().toUpperCase());
}

/** router.param('cnr', cnrParam) — validates the path param and exposes req.cnr (upper-case). */
function cnrParam(req, res, next, value) {
    if (!isValidCnr(value)) {
        return next(new HttpError(400, 'invalid_cnr', 'CNR must be 4 letters followed by 12 digits (16 characters).'));
    }
    req.cnr = value.trim().toUpperCase();
    next();
}

/** router.param('hearingId', hearingIdParam) */
function hearingIdParam(req, res, next, value) {
    if (!/^\d{1,4}$/.test(value)) {
        return next(new HttpError(400, 'invalid_hearing_id', 'hearingId must be a positive integer.'));
    }
    req.hearingId = Number(value);
    next();
}

function requireString(value, name, { max = 200 } = {}) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        throw new HttpError(400, 'invalid_request', `"${name}" is required and must be a string (max ${max} chars).`);
    }
    return value.trim();
}

/** Clamp a numeric body field into [min, max]; returns the fallback for missing values. */
function numberInRange(value, name, { min, max, fallback }) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new HttpError(400, 'invalid_request', `"${name}" must be a number between ${min} and ${max}.`);
    }
    return n;
}

module.exports = { CNR_RE, isValidCnr, cnrParam, hearingIdParam, requireString, numberInRange };
