process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = ''; // tests must never call a real AI service

const { loadConfig } = require('../config/env');
const { createApp } = require('../app');

/** A test config with generous rate limits unless overridden. */
function testConfig(overrides = {}) {
    const base = loadConfig({ NODE_ENV: 'test', RATE_LIMIT_GENERAL: '1000', RATE_LIMIT_ECOURTS: '1000', RATE_LIMIT_ORDER: '1000' });
    return { ...base, ...overrides, gemini: { ...base.gemini, ...(overrides.gemini || {}) } };
}

/** Starts the app on an ephemeral port; returns { request, close }. */
async function startApp(deps = {}) {
    const app = createApp({ config: testConfig(deps.configOverrides), ...deps });
    const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;

    async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
        const init = { method, headers: { ...headers } };
        if (body !== undefined) {
            init.body = typeof body === 'string' ? body : JSON.stringify(body);
            init.headers['content-type'] = init.headers['content-type'] || 'application/json';
        }
        const res = await fetch(base + path, init);
        if (raw) return res;
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (_) { /* not JSON */ }
        return { status: res.status, headers: res.headers, json, text };
    }
    return { request, base, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { startApp, testConfig };
