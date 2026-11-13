const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startApp } = require('../test-utils/helpers');

let app;
test.before(async () => { app = await startApp(); });
test.after(async () => { await app.close(); });

const CNR = 'MHNA010000012019';

test('health and index', async () => {
    const h = await app.request('/api/health');
    assert.equal(h.status, 200);
    assert.equal(h.json.status, 'ok');
    assert.equal(h.json.demoCasesLoaded, 5);
    assert.equal(h.json.persistence, 'memory');
    assert.equal((await app.request('/')).json.name, 'Vakalat API');
});

test('demo cases list and case lookup', async () => {
    const list = await app.request('/api/demo-cases');
    assert.equal(list.json.length, 5);
    const c = await app.request(`/api/case/${CNR.toLowerCase()}`); // lower-case is accepted
    assert.equal(c.status, 200);
    assert.equal(c.json.hearings.length, 14);
    assert.ok(c.json.hearings.every((h) => !('orderRef' in h)));
    assert.equal(c.json.hearingStats.total, 14);
});

test('validation: bad CNR → 400, unknown CNR → 404, JSON errors without stack traces', async () => {
    const bad = await app.request('/api/case/abc');
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, 'invalid_cnr');

    const missing = await app.request('/api/case/ZZZZ000000000000');
    assert.equal(missing.status, 404);
    assert.equal(missing.json.error, 'case_not_found');

    const noBody = await app.request(`/api/case/${CNR}/cost`, { method: 'POST' }); // no JSON body at all → defaults
    assert.equal(noBody.status, 200);

    const malformed = await app.request('/api/case/search', { method: 'POST', body: '{not json', headers: { 'content-type': 'application/json' } });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.json.error, 'invalid_json');

    for (const r of [bad, missing, malformed, await app.request('/api/nope')]) {
        assert.doesNotMatch(r.text, /\.js:\d+|node_modules|C:\\|at .*\(/, 'no stack trace or file path in the response');
    }
});

test('the old unauthenticated cache-clearing route and /drain are gone', async () => {
    assert.equal((await app.request(`/api/case/cache/${CNR}`, { method: 'DELETE' })).status, 404);
    assert.equal((await app.request(`/api/case/${CNR}/drain`, { method: 'POST', body: {} })).status, 404);
    assert.equal((await app.request(`/api/case/${CNR}/lawyer-stats`)).status, 404);
});

test('search accepts party/advocate only', async () => {
    const ok = await app.request('/api/case/search', { method: 'POST', body: { type: 'party', query: 'sharma' } });
    assert.equal(ok.json.count, 1);
    const bad = await app.request('/api/case/search', { method: 'POST', body: { type: 'casenumber', query: 'x' } });
    assert.equal(bad.status, 400);
});

test('derived endpoints', async () => {
    const stage = (await app.request(`/api/case/${CNR}/stage`)).json;
    assert.equal(stage.currentStage, 5);
    assert.equal(stage.stages.find((s) => s.isCurrent).stageNumber, 5);

    const q = (await app.request(`/api/case/${CNR}/questions`)).json;
    assert.equal(q.questions.length, 5);
    assert.ok(q.questions.every((x) => x.q && x.why));

    const prep = (await app.request(`/api/case/${CNR}/prep`)).json;
    assert.ok(prep.daysUntilNextHearing > 0, 'demo next hearing is in the future');
    assert.ok(prep.preparationChecklist.length >= 4);

    const wa = (await app.request(`/api/case/${CNR}/whatsapp`)).json;
    assert.match(wa.whatsappUrl, /^https:\/\/wa\.me\/\?text=/);
    assert.equal((await app.request(`/api/case/${CNR}/whatsapp-alert`)).status, 404); // merged into /whatsapp

    const summary = (await app.request(`/api/case/${CNR}/summary`)).json;
    assert.equal(summary.recentHearings[0].id, 14); // newest first
    assert.ok(summary.estimatedCost.amount > 0);
});

test('translate', async () => {
    assert.equal((await app.request('/api/translate?code=nnfr')).json.type, 'business');
    assert.equal((await app.request('/api/translate?code=PE')).json.type, 'stage');
    assert.equal((await app.request('/api/translate?code=nope')).status, 404);
    assert.equal((await app.request('/api/translate')).status, 400);
    assert.equal((await app.request('/api/translate?code=__proto__')).status, 404);
});

test('cost endpoint: the single source of truth', async () => {
    const r = await app.request(`/api/case/${CNR}/cost`, { method: 'POST', body: { seniorFeePerHearing: 5000, workerType: 'unskilled_casual', travelMode: 'local' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.adjournedCount, 10);
    assert.equal(r.json.unclearCount, 0);
    assert.ok(r.json.totalDrain > 0);
    assert.ok(r.json.recoverableFromOP > 0, 'opposite-party adjournments are recognised');
    assert.equal(r.json.costHeadSummary.professionalFees > 0, true);

    const pricier = await app.request(`/api/case/${CNR}/cost`, { method: 'POST', body: { seniorFeePerHearing: 50000 } });
    assert.ok(pricier.json.totalDrain > r.json.totalDrain);

    for (const body of [{ seniorFeePerHearing: -1 }, { seniorFeePerHearing: 'abc' }, { workerType: 'wizard' }, { travelMode: 'rocket' }, { juniorCount: 99 }]) {
        assert.equal((await app.request(`/api/case/${CNR}/cost`, { method: 'POST', body })).status, 400, JSON.stringify(body));
    }
    assert.ok((await app.request('/api/cost-config')).json.workerTypes.length >= 6);
});

test('live lookup validates input before touching eCourts', async () => {
    assert.equal((await app.request('/api/case/cnr/live', { method: 'POST', body: {} })).status, 400);
    assert.equal((await app.request('/api/case/cnr/live', { method: 'POST', body: { cnr: 'short', captcha: 'a', sessionId: 'x' } })).status, 400);
    assert.equal((await app.request('/api/case/cnr/live', { method: 'POST', body: { cnr: 123, captcha: 'a', sessionId: 'x' } })).status, 400);
    assert.equal((await app.request('/api/captcha?courtType=mars')).status, 400);
});

test('CORS: allow-listed origin gets headers, others do not', async () => {
    const ok = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const evil = await app.request('/api/health', { headers: { Origin: 'http://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
});

test('security headers and body-size limit', async () => {
    const r = await app.request('/api/health');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    const big = await app.request('/api/case/search', { method: 'POST', body: JSON.stringify({ type: 'party', query: 'x'.repeat(20000) }) });
    assert.equal(big.status, 413);
});

test('rate limiting: the eCourts-facing routes are throttled', async () => {
    const limited = await startApp({ configOverrides: { rateLimit: { windowMs: 60000, general: 1000, ecourts: 3, order: 1000 } } });
    try {
        const codes = [];
        for (let i = 0; i < 5; i++) codes.push((await limited.request('/api/captcha?courtType=mars')).status); // cheap 400s still count
        assert.deepEqual(codes, [400, 400, 400, 429, 429]);
        const r = await limited.request('/api/captcha?courtType=mars');
        assert.equal(r.json.error, 'rate_limited');
        assert.ok(r.headers.get('ratelimit') || r.headers.get('ratelimit-policy'));
    } finally { await limited.close(); }
});

test('SSRF regression: a client-supplied pdfUrl is never fetched', async () => {
    let hits = 0;
    const listener = http.createServer((req, res) => { hits++; res.end('{"order":"x.pdf"}'); });
    await new Promise((r) => listener.listen(0, '127.0.0.1', r));
    const port = listener.address().port;
    try {
        const forged = encodeURIComponent(`ecourts-pdf://http://127.0.0.1:${port}/|n|c|k|f.pdf`);
        for (const route of ['download', 'text', 'summary', 'actions']) {
            await app.request(`/api/order/${CNR}/4/${route}?pdfUrl=${forged}&sessionId=x`, { raw: true });
            await app.request(`/api/order/${CNR}/1/${route}?pdfUrl=${forged}`, { raw: true }); // hearing without an order
        }
        assert.equal(hits, 0, 'the server must not contact a host named by the client');
    } finally { listener.close(); }
});
