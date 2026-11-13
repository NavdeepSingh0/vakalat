/**
 * Central, validated configuration. Everything that reads process.env goes through here.
 * `loadConfig(env)` is pure so tests can pass their own environment.
 */
require('dotenv').config({ quiet: true });

function intFrom(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < min || n > max) return fallback;
    return n;
}

function loadConfig(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    return {
        nodeEnv,
        isProduction: nodeEnv === 'production',
        isTest: nodeEnv === 'test',
        port: intFrom(env.PORT, 3000, { min: 0, max: 65535 }),
        // Comma-separated list of browser origins allowed to call the API.
        corsOrigins: (env.CORS_ORIGIN || 'http://localhost:5173')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
        logLevel: env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
        // How long live-scraped cases (and the eCourts session used to fetch orders) stay in memory.
        caseCacheTtlMs: intFrom(env.CASE_CACHE_TTL_MIN, 30, { min: 1, max: 1440 }) * 60 * 1000,
        gemini: {
            apiKey: env.GEMINI_API_KEY || '',
            // Override with GEMINI_MODEL if Google retires this id.
            model: env.GEMINI_MODEL || 'gemini-2.5-flash',
        },
        firebaseServiceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
        rateLimit: {
            windowMs: intFrom(env.RATE_LIMIT_WINDOW_SEC, 60, { min: 1 }) * 1000,
            general: intFrom(env.RATE_LIMIT_GENERAL, 120, { min: 1 }),
            ecourts: intFrom(env.RATE_LIMIT_ECOURTS, 10, { min: 1 }),
            order: intFrom(env.RATE_LIMIT_ORDER, 20, { min: 1 }),
        },
    };
}

module.exports = { loadConfig, config: loadConfig() };
