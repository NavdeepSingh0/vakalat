const { rateLimit } = require('express-rate-limit');

function limiter(limit, windowMs, name) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'rate_limited', message: `Too many ${name} requests. Please slow down and try again shortly.` },
    });
}

/** Builds the three limiters used by the app from config.rateLimit. */
function createLimiters(cfg) {
    const { windowMs, general, ecourts, order } = cfg.rateLimit;
    return {
        general: limiter(general, windowMs, 'API'),
        // Every call hits the eCourts portal on our behalf — keep this strict.
        ecourts: limiter(ecourts, windowMs, 'eCourts lookup'),
        order: limiter(order, windowMs, 'order'),
    };
}

module.exports = { createLimiters };
