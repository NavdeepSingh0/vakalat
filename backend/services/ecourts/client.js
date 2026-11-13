/**
 * eCourts HTTP client — plain HTTP (axios), manual cookie handling, no browser.
 *
 * Flow:
 *   1. GET portal home          → session cookies
 *   2. POST getCaptcha          → CAPTCHA <img> + more cookies
 *   3. GET CAPTCHA image        → returned to the user as a data URL (the USER solves it)
 *   4. POST searchByCNR         → case HTML; cookies are kept (per CNR) so order PDFs can be fetched later
 *
 * Nothing here logs the CNR, the CAPTCHA text or any cookie value.
 */
const axios = require('axios');
const crypto = require('node:crypto');
const cheerio = require('cheerio');
const { HttpError } = require('../../middleware/errorHandler');
const logger = require('../logger');
const { parseCaseHTML } = require('./parser');

const PORTALS = {
    district: {
        name: 'District Court',
        base: 'https://services.ecourts.gov.in/ecourtindia_v6/',
        pdfBase: 'https://services.ecourts.gov.in/ecourtindia_v6/',
        origin: 'https://services.ecourts.gov.in',
        captchaEndpoint: '?p=casestatus/getCaptcha',
        searchEndpoint: '?p=cnr_status/searchByCNR/',
        captchaImageSelector: '#captcha_image',
    },
    highcourt: {
        name: 'High Court',
        base: 'https://hcservices.ecourts.gov.in/hcservices/',
        pdfBase: 'https://hcservices.ecourts.gov.in/hcservices/',
        origin: 'https://hcservices.ecourts.gov.in',
        captchaEndpoint: '?p=casestatus/getCaptcha',
        searchEndpoint: '?p=cnr_status/searchByCNR/',
        captchaImageSelector: '#captcha_image',
    },
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

// ── Cookie helpers ──────────────────────────────────────────────────────────────────────────────
function extractCookies(response) {
    const header = response.headers && response.headers['set-cookie'];
    if (!header) return {};
    const out = {};
    for (const raw of Array.isArray(header) ? header : [header]) {
        const pair = raw.split(';')[0].trim();
        const eq = pair.indexOf('=');
        if (eq > 0) out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
    return out;
}
const mergeCookies = (a, b) => ({ ...a, ...b });
const cookieString = (jar) => Object.entries(jar || {}).map(([k, v]) => `${k}=${v}`).join('; ');

// ── Response interpretation ────────────────────────────────────────────────────────────────────
const fail = (error, message) => ({ error: { success: false, error, message } });

function extractHtmlFromResponse(data) {
    if (typeof data === 'object' && data !== null) {
        const errormsg = String(data.errormsg || data.error || data.msg || '').toLowerCase();
        const long = (v) => typeof v === 'string' && v.length > 100;
        const hasRealData = long(data.history_cnr) || long(data.ct_case_status) || long(data.historytable) || long(data.casetype_list);

        if (!hasRealData) {
            if (errormsg.includes('invalid captcha') || errormsg.includes('captcha not match')) {
                return fail('invalid_captcha', 'Invalid CAPTCHA. Please try again.');
            }
            if (errormsg.includes('invalid cnr') || errormsg.includes('record not found') || errormsg.includes('no record')) {
                return fail('invalid_cnr', 'Invalid CNR or no records found.');
            }
            if (data.div_captcha && !data.history_cnr && !data.ct_case_status && !data.casetype_list) {
                return fail('invalid_captcha', 'CAPTCHA validation failed. Please fetch a new CAPTCHA.');
            }
        }

        const fragments = [data.ct_case_status, data.casetype_list, data.history_cnr, data.historytable, data.pdflist, data.html, data.data]
            .filter((f) => typeof f === 'string' && f.length > 0);
        if (fragments.length > 0) return { html: fragments.join('\n') };
        return fail('unexpected_response', 'eCourts returned data in a format we could not understand.');
    }

    if (typeof data === 'string') {
        const low = data.toLowerCase();
        if (low.includes('invalid captcha')) return fail('invalid_captcha', 'Invalid CAPTCHA.');
        if (low.includes('invalid cnr') || low.includes('record not found')) return fail('invalid_cnr', 'Invalid CNR or no records found.');
        return { html: data };
    }
    return fail('unknown_response', 'Unrecognised response from eCourts.');
}

// ── Client factory (http + clock injectable for tests) ─────────────────────────────────────────
function createEcourtsClient({ http = axios, now = () => Date.now(), caseSessionTtlMs = 30 * 60 * 1000 } = {}) {
    const captchaSessions = new Map(); // sessionId → { cookies, courtType, createdAt }
    const caseSessions = new Map(); // CNR → { cookies, courtType, createdAt }

    function sweep() {
        const t = now();
        for (const [id, s] of captchaSessions) if (t - s.createdAt > CAPTCHA_TTL_MS) captchaSessions.delete(id);
        for (const [id, s] of caseSessions) if (t - s.createdAt > caseSessionTtlMs) caseSessions.delete(id);
    }

    async function fetchCaptcha(courtType = 'district') {
        const portal = PORTALS[courtType];
        if (!portal) throw new HttpError(400, 'invalid_court_type', `courtType must be one of: ${Object.keys(PORTALS).join(', ')}`);

        let cookies = {};
        const home = await http.get(portal.base, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
            maxRedirects: 5, timeout: 20000, validateStatus: () => true,
        });
        cookies = mergeCookies(cookies, extractCookies(home));

        const captchaRes = await http.post(portal.base + portal.captchaEndpoint, 'ajax_req=true&app_token=', {
            headers: {
                'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
                Referer: portal.base, Origin: portal.origin, Cookie: cookieString(cookies), Accept: 'application/json, text/javascript, */*; q=0.01',
            },
            timeout: 20000, validateStatus: () => true,
        });
        cookies = mergeCookies(cookies, extractCookies(captchaRes));

        let body = captchaRes.data;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { /* not JSON */ } }
        let imgSrc = '';
        if (body && body.div_captcha) {
            const $ = cheerio.load(body.div_captcha);
            imgSrc = $(portal.captchaImageSelector).attr('src') || $('img').first().attr('src') || '';
        }
        if (!imgSrc) {
            const refused = body && typeof body.errormsg === 'string' && /invalid request/i.test(body.errormsg);
            throw new Error(refused
                ? 'eCourts rejected the CAPTCHA request ("Invalid Request"); the portal appears to refuse automated clients.'
                : 'Could not find the CAPTCHA image in the eCourts response.');
        }

        // Only ever fetch the image from the portal's own origin.
        const imgUrl = new URL(imgSrc, portal.origin + '/');
        if (imgUrl.origin !== portal.origin) throw new Error('CAPTCHA image pointed to an unexpected host.');

        const img = await http.get(imgUrl.href, {
            headers: { 'User-Agent': USER_AGENT, Cookie: cookieString(cookies), Referer: portal.base, Accept: 'image/*,*/*;q=0.8' },
            responseType: 'arraybuffer', timeout: 20000, maxContentLength: 1024 * 1024, validateStatus: () => true,
        });
        cookies = mergeCookies(cookies, extractCookies(img));
        const buf = Buffer.from(img.data);
        if (buf.length < 100) throw new Error('CAPTCHA image download failed (empty response).');

        const sessionId = `sess_${crypto.randomUUID()}`;
        captchaSessions.set(sessionId, { cookies, courtType, createdAt: now() });
        sweep();
        logger.debug({ courtType, bytes: buf.length }, 'captcha issued');
        return { sessionId, courtType, captchaDataUrl: `data:image/png;base64,${buf.toString('base64')}` };
    }

    async function searchByCNR(cnr, captchaCode, sessionId) {
        const session = captchaSessions.get(sessionId);
        if (!session || now() - session.createdAt > CAPTCHA_TTL_MS) {
            captchaSessions.delete(sessionId);
            return { success: false, error: 'session_expired', message: 'Session expired. Please fetch a new CAPTCHA.' };
        }
        captchaSessions.delete(sessionId); // a CAPTCHA session is single-use

        const portal = PORTALS[session.courtType];
        const cnrClean = String(cnr).trim().toUpperCase();
        const body = new URLSearchParams({ cino: cnrClean, fcaptcha_code: String(captchaCode).trim(), ajax_req: 'true', app_token: '' }).toString();

        const res = await http.post(portal.base + portal.searchEndpoint, body, {
            headers: {
                'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
                Referer: portal.base, Origin: portal.origin, Cookie: cookieString(session.cookies), Accept: 'application/json, text/javascript, */*; q=0.01',
            },
            validateStatus: () => true, timeout: 30000,
        });

        let data = res.data;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { /* raw HTML */ } }

        const extracted = extractHtmlFromResponse(data);
        if (extracted.error) return extracted.error;
        if (!extracted.html || extracted.html.length < 50) {
            return { success: false, error: 'empty_response', message: 'No case data returned from eCourts.' };
        }

        const caseData = parseCaseHTML(extracted.html, cnrClean, session.courtType);
        const nothingParsed = caseData.hearings.length === 0 && caseData.caseType === 'Unknown' && caseData.title.startsWith('Case ');
        if (nothingParsed) {
            return { success: false, error: 'no_case_data', message: 'eCourts returned a page, but no case details could be read from it.' };
        }

        // Keep the cookie jar so this case's order PDFs can be downloaded later (server-side only).
        caseSessions.set(cnrClean, { cookies: mergeCookies(session.cookies, extractCookies(res)), courtType: session.courtType, createdAt: now() });
        sweep();
        logger.info({ courtType: session.courtType, hearings: caseData.hearings.length }, 'case parsed');
        return { success: true, data: caseData };
    }

    function getCaseSession(cnr) {
        const s = caseSessions.get(String(cnr).toUpperCase());
        if (!s) return null;
        if (now() - s.createdAt > caseSessionTtlMs) { caseSessions.delete(String(cnr).toUpperCase()); return null; }
        return s;
    }

    /**
     * Downloads one order PDF. The target host comes ONLY from PORTALS[session.courtType] —
     * never from client input or from the scraped page.
     */
    async function fetchOrderPdf(cnr, ref) {
        const session = getCaseSession(cnr);
        if (!session) {
            throw new HttpError(401, 'session_expired', 'Your eCourts session has expired. Please search this case again to download orders.');
        }
        const portal = PORTALS[session.courtType];
        const headers = {
            'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*', 'Accept-Language': 'en-US,en;q=0.9',
            Referer: portal.pdfBase, Cookie: cookieString(session.cookies),
        };
        const limits = { maxContentLength: MAX_PDF_BYTES, maxBodyLength: MAX_PDF_BYTES };

        let pdfUrl;
        if (session.courtType === 'highcourt') {
            pdfUrl = `${portal.pdfBase}viewfile.php?filename=${encodeURIComponent(ref.filename)}`;
        } else {
            const params = new URLSearchParams({
                normal_v: ref.normalV, case_val: ref.caseVal, court_code: ref.courtCode,
                filename: ref.filename, appFlag: '', ajax_req: 'true', app_token: '',
            });
            const step1 = await http.post(`${portal.pdfBase}?p=home/display_pdf`, params.toString(), {
                headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, timeout: 20000, ...limits,
            });
            let json = step1.data;
            if (typeof json === 'string') { try { json = JSON.parse(json); } catch (_) { json = null; } }
            if (!json || typeof json.order !== 'string' || !json.order) {
                throw new HttpError(502, 'order_unavailable', 'eCourts did not return a link for this order.');
            }
            const resolved = new URL(json.order, portal.pdfBase);
            if (resolved.origin !== new URL(portal.pdfBase).origin) {
                throw new HttpError(502, 'order_unavailable', 'eCourts returned an unexpected order location.');
            }
            pdfUrl = resolved.href;
        }

        const res = await http.get(pdfUrl, { headers, responseType: 'arraybuffer', timeout: 30000, ...limits });
        const buf = Buffer.from(res.data);
        if (buf.subarray(0, 5).toString() !== '%PDF-') {
            const preview = buf.subarray(0, 300).toString('utf8').toLowerCase();
            if (preview.includes('session') || preview.includes('captcha')) {
                throw new HttpError(401, 'session_expired', 'Your eCourts session has expired. Please search this case again to download orders.');
            }
            throw new HttpError(502, 'order_unavailable', 'eCourts returned something that is not a PDF.');
        }
        return buf;
    }

    return { fetchCaptcha, searchByCNR, getCaseSession, fetchOrderPdf, sweep, _captchaSessions: captchaSessions, _caseSessions: caseSessions };
}

module.exports = {
    PORTALS, createEcourtsClient, extractHtmlFromResponse,
    extractCookies, mergeCookies, cookieString,
};
