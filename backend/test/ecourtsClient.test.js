const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createEcourtsClient, extractHtmlFromResponse, cookieString, extractCookies } = require('../services/ecourts/client');
const { textToPdf } = require('../services/simplePdf');

const caseHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'case.html'), 'utf8');

test('cookie helpers round-trip', () => {
    const jar = extractCookies({ headers: { 'set-cookie': ['A=1; Path=/; HttpOnly', 'B=two; Secure'] } });
    assert.deepEqual(jar, { A: '1', B: 'two' });
    assert.equal(cookieString(jar), 'A=1; B=two');
    assert.equal(typeof cookieString(jar), 'string'); // old bug: an object was sent as "[object Object]"
});

test('extractHtmlFromResponse recognises the portal error cases', () => {
    assert.equal(extractHtmlFromResponse({ errormsg: 'Invalid Captcha' }).error.error, 'invalid_captcha');
    assert.equal(extractHtmlFromResponse({ errormsg: 'Record not found' }).error.error, 'invalid_cnr');
    assert.equal(extractHtmlFromResponse({ div_captcha: '<img>' }).error.error, 'invalid_captcha');
    assert.equal(extractHtmlFromResponse({ foo: 'bar' }).error.error, 'unexpected_response');
    assert.equal(extractHtmlFromResponse(42).error.error, 'unknown_response');
    assert.ok(extractHtmlFromResponse({ history_cnr: 'x'.repeat(200) }).html);
    // real data wins even when an error message is present
    assert.ok(extractHtmlFromResponse({ errormsg: 'invalid captcha', ct_case_status: 'y'.repeat(200) }).html);
});

function fakeHttp(handlers) {
    const calls = [];
    const pick = (method) => async (url, a, b) => {
        calls.push({ method, url, a, b });
        const h = handlers[method];
        return h(url, a, b);
    };
    return { get: pick('get'), post: pick('post'), calls };
}

const CAPTCHA_JSON = { div_captcha: '<img id="captcha_image" src="/ecourtindia_v6/captcha.png">' };
const PNG = Buffer.alloc(300, 1);

function portalHttp({ search }) {
    return fakeHttp({
        get: async (url) => (url.endsWith('captcha.png') ? { data: PNG, headers: {} } : { data: '<html/>', headers: { 'set-cookie': ['SERVICES_SESSID=abc; Path=/'] } }),
        post: async (url) => (url.includes('getCaptcha') ? { data: CAPTCHA_JSON, headers: {} } : search(url)),
    });
}

test('captcha → search → case session kept for orders', async () => {
    const http = portalHttp({ search: async () => ({ data: { ct_case_status: caseHtml }, headers: {} }) });
    const client = createEcourtsClient({ http });

    const cap = await client.fetchCaptcha('district');
    assert.match(cap.sessionId, /^sess_/);
    assert.match(cap.captchaDataUrl, /^data:image\/png;base64,/);

    const result = await client.searchByCNR('KLTS010000452019', 'abc123', cap.sessionId);
    assert.equal(result.success, true);
    assert.equal(result.data.hearings.length, 5);

    // The CAPTCHA session is single-use...
    assert.equal((await client.searchByCNR('KLTS010000452019', 'abc123', cap.sessionId)).error, 'session_expired');
    // ...but the cookie jar is kept for this case so orders can be fetched.
    assert.ok(client.getCaseSession('KLTS010000452019'));
    assert.equal(client.getCaseSession('KLTS010000452019').cookies.SERVICES_SESSID, 'abc');
});

test('wrong CAPTCHA and unreadable pages are reported, not cached', async () => {
    const bad = createEcourtsClient({ http: portalHttp({ search: async () => ({ data: { errormsg: 'Invalid Captcha' }, headers: {} }) }) });
    const cap = await bad.fetchCaptcha();
    assert.equal((await bad.searchByCNR('KLTS010000452019', 'x', cap.sessionId)).error, 'invalid_captcha');
    assert.equal(bad.getCaseSession('KLTS010000452019'), null);

    const junk = createEcourtsClient({ http: portalHttp({ search: async () => ({ data: { ct_case_status: '<p>'.padEnd(120, 'z') }, headers: {} }) }) });
    const cap2 = await junk.fetchCaptcha();
    assert.equal((await junk.searchByCNR('KLTS010000452019', 'x', cap2.sessionId)).error, 'no_case_data');
});

test('captcha sessions and case sessions expire', async () => {
    let t = 0;
    const http = portalHttp({ search: async () => ({ data: { ct_case_status: caseHtml }, headers: {} }) });
    const client = createEcourtsClient({ http, now: () => t, caseSessionTtlMs: 1000 });
    const cap = await client.fetchCaptcha();
    t += 11 * 60 * 1000;
    assert.equal((await client.searchByCNR('KLTS010000452019', 'x', cap.sessionId)).error, 'session_expired');

    t = 0;
    const cap2 = await client.fetchCaptcha();
    await client.searchByCNR('KLTS010000452019', 'x', cap2.sessionId);
    t += 1001;
    assert.equal(client.getCaseSession('KLTS010000452019'), null);
});

async function clientWithCase(http) {
    const client = createEcourtsClient({ http });
    const cap = await client.fetchCaptcha();
    await client.searchByCNR('KLTS010000452019', 'x', cap.sessionId);
    return client;
}

test('fetchOrderPdf only talks to the portal host and sends cookies as a string', async () => {
    const pdf = textToPdf('hello order');
    const http = fakeHttp({
        get: async (url) => {
            if (url.endsWith('captcha.png')) return { data: PNG, headers: {} };
            if (url.endsWith('reports/x.pdf')) return { data: pdf, headers: {} };
            return { data: '<html/>', headers: { 'set-cookie': ['SERVICES_SESSID=abc'] } };
        },
        post: async (url) => {
            if (url.includes('getCaptcha')) return { data: CAPTCHA_JSON, headers: {} };
            if (url.includes('display_pdf')) return { data: { order: 'reports/x.pdf' }, headers: {} };
            return { data: { ct_case_status: caseHtml }, headers: {} };
        },
    });
    const client = await clientWithCase(http);
    const buf = await client.fetchOrderPdf('KLTS010000452019', { normalV: 'a', caseVal: 'b', courtCode: 'c', filename: 'f.pdf' });
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');

    const orderCalls = http.calls.filter((c) => /display_pdf|\.pdf$/.test(c.url));
    assert.ok(orderCalls.length >= 2);
    for (const c of orderCalls) {
        assert.ok(c.url.startsWith('https://services.ecourts.gov.in/'), c.url);
        const cookie = (c.b && c.b.headers && c.b.headers.Cookie) || (c.a && c.a.headers && c.a.headers.Cookie);
        assert.equal(typeof cookie, 'string');
        assert.match(cookie, /SERVICES_SESSID=abc/);
    }
});

test('a hostile "order" location from the portal cannot redirect the download to another host', async () => {
    const http = fakeHttp({
        get: async (url) => (url.endsWith('captcha.png') ? { data: PNG, headers: {} } : { data: '<html/>', headers: {} }),
        post: async (url) => {
            if (url.includes('getCaptcha')) return { data: CAPTCHA_JSON, headers: {} };
            if (url.includes('display_pdf')) return { data: { order: 'https://evil.example/x.pdf' }, headers: {} };
            return { data: { ct_case_status: caseHtml }, headers: {} };
        },
    });
    const client = await clientWithCase(http);
    await assert.rejects(
        client.fetchOrderPdf('KLTS010000452019', { normalV: 'a', caseVal: 'b', courtCode: 'c', filename: 'f.pdf' }),
        (err) => err.code === 'order_unavailable',
    );
    assert.ok(!http.calls.some((c) => String(c.url).includes('evil.example')));
});

test('fetchOrderPdf without a session asks the user to search again', async () => {
    const client = createEcourtsClient({ http: fakeHttp({}) });
    await assert.rejects(client.fetchOrderPdf('KLTS010000452019', {}), (err) => err.status === 401 && err.code === 'session_expired');
});
