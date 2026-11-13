/**
 * Structured logger (pino). Case identifiers, CAPTCHA text and cookies are redacted so that
 * nothing personal ends up in logs even if an object containing them is logged by mistake.
 */
const pino = require('pino');
const { config } = require('../config/env');

const redact = {
    paths: [
        'cnr', 'captcha', 'cookie', 'cookies', 'sessionId',
        '*.cnr', '*.captcha', '*.cookie', '*.cookies', '*.sessionId',
        'req.headers.cookie', 'req.headers.authorization',
    ],
    censor: '[redacted]',
};

function createLogger(cfg = config) {
    const options = { level: cfg.logLevel, redact };
    // Pretty output only in local development (pino-pretty is a devDependency).
    if (cfg.nodeEnv === 'development') {
        try {
            require.resolve('pino-pretty');
            return pino({ ...options, transport: { target: 'pino-pretty', options: { colorize: true } } });
        } catch (_) { /* fall through to JSON logs */ }
    }
    return pino(options);
}

module.exports = createLogger();
module.exports.createLogger = createLogger;
