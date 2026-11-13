/**
 * Final JSON error handling. Never returns stack traces or file paths.
 */
const logger = require('../services/logger');

class HttpError extends Error {
    constructor(status, code, message, extra = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.extra = extra;
    }
}

function notFound(req, res) {
    res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    // Malformed / oversized JSON bodies from express.json()
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON.' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'payload_too_large', message: 'Request body is too large.' });
    }

    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
    }

    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) logger.error({ err: { name: err.name, message: err.message } }, 'unhandled error');

    res.status(status).json({
        error: status >= 500 ? 'internal_error' : 'bad_request',
        message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    });
}

module.exports = { HttpError, notFound, errorHandler };
