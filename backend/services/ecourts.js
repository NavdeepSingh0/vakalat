/**
 * eCourts Scraper — PURE HTTP (No Puppeteer)
 * 
 * Uses Axios with manual cookie management.
 * Flow:
 *   1. GET homepage → capture session cookies
 *   2. POST getCaptcha → get CAPTCHA HTML + more cookies
 *   3. GET CAPTCHA image → send base64 to user
 *   4. User solves CAPTCHA
 *   5. POST searchByCNR with same cookies → get case data
 * 
 * No browser. No DOM. No synthetic events. Just HTTP.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════
// Portal configurations
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
// Session store
// ═══════════════════════════════════════════════
const sessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000;

// ═══════════════════════════════════════════════
// Cookie helpers — manual extraction and merging
// ═══════════════════════════════════════════════
function extractCookies(axiosResponse) {
    const setCookieHeaders = axiosResponse.headers['set-cookie'];
    if (!setCookieHeaders) return {};

    const cookies = {};
    const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const raw of arr) {
        // "name=value; Path=/; HttpOnly" → take "name=value"
        const pair = raw.split(';')[0].trim();
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
            const name = pair.substring(0, eqIdx).trim();
            const value = pair.substring(eqIdx + 1).trim();
            cookies[name] = value;
        }
    }
    return cookies;
}

function mergeCookies(existing, incoming) {
    return { ...existing, ...incoming };
}

function cookieString(cookieObj) {
    return Object.entries(cookieObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

// ═══════════════════════════════════════════════
// fetchCaptcha  — PURE HTTP
// ═══════════════════════════════════════════════
async function fetchCaptcha(courtType = 'district') {
    const portal = PORTALS[courtType];
    if (!portal) throw new Error(`Unknown court type: ${courtType}`);

    console.log(`🔑 [fetchCaptcha] Pure HTTP — ${portal.name}...`);

    let cookies = {};

    // ── Step 1: GET homepage to establish session cookies ────────────────
    console.log('   Step 1: GET homepage...');
    const res1 = await axios.get(portal.base, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        maxRedirects: 5,
        validateStatus: () => true, // accept any status
    });
    cookies = mergeCookies(cookies, extractCookies(res1));
    console.log(`   Cookies after homepage: ${Object.keys(cookies).join(', ') || '(none)'}`);

    // ── Step 2: POST getCaptcha to get CAPTCHA HTML + session IDs ────────
    console.log('   Step 2: POST getCaptcha...');
    const res2 = await axios.post(
        portal.base + portal.captchaEndpoint,
        'ajax_req=true&app_token=',
        {
            headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': portal.base,
                'Origin': portal.origin,
                'Cookie': cookieString(cookies),
                'Accept': 'application/json, text/javascript, */*; q=0.01',
            },
            validateStatus: () => true,
        }
    );
    cookies = mergeCookies(cookies, extractCookies(res2));
    console.log(`   Cookies after getCaptcha: ${Object.keys(cookies).join(', ')}`);

    // Parse the CAPTCHA HTML to find the image URL
    let captchaData = res2.data;
    if (typeof captchaData === 'string') {
        try { captchaData = JSON.parse(captchaData); } catch (e) { /* not JSON */ }
    }

    let imgSrc = '';
    if (captchaData && captchaData.div_captcha) {
        const $ = cheerio.load(captchaData.div_captcha);
        imgSrc = $(portal.captchaImageSelector).attr('src') || '';
        if (!imgSrc) {
            // Try any <img> tag
            imgSrc = $('img').first().attr('src') || '';
        }
    }

    if (!imgSrc) {
        console.error('   ❌ Could not find CAPTCHA image in response.');
        console.error('   Response keys:', typeof captchaData === 'object' ? Object.keys(captchaData) : 'not object');
        throw new Error('Failed to extract CAPTCHA image URL from eCourts response.');
    }

    console.log(`   CAPTCHA image src: ${imgSrc.substring(0, 80)}...`);

    // ── Step 3: GET the actual CAPTCHA image ─────────────────────────────
    const imgUrl = imgSrc.startsWith('http')
        ? imgSrc
        : `${portal.origin}${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;

    console.log(`   Step 3: GET CAPTCHA image: ${imgUrl.substring(0, 80)}...`);
    const res3 = await axios.get(imgUrl, {
        headers: {
            'User-Agent': USER_AGENT,
            'Cookie': cookieString(cookies),
            'Referer': portal.base,
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
    });
    cookies = mergeCookies(cookies, extractCookies(res3));

    const imgBuffer = Buffer.from(res3.data);
    if (imgBuffer.length < 100) {
        console.error(`   ❌ CAPTCHA image too small: ${imgBuffer.length} bytes`);
        throw new Error('CAPTCHA image download failed — received empty or tiny image.');
    }

    const base64 = imgBuffer.toString('base64');
    console.log(`   ✅ CAPTCHA image: ${imgBuffer.length} bytes`);

    // ── Store session ────────────────────────────────────────────────────
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    sessions.set(sessionId, {
        cookies,
        courtType,
        createdAt: Date.now(),
    });
    cleanupSessions();

    console.log(`   ✅ Session stored: ${sessionId}`);
    console.log(`   Final cookies: ${cookieString(cookies).substring(0, 120)}...`);

    return {
        sessionId,
        courtType,
        captchaDataUrl: `data:image/png;base64,${base64}`,
    };
}

// ═══════════════════════════════════════════════
// searchByCNR  — PURE HTTP
// ═══════════════════════════════════════════════
async function searchByCNR(cnr, captchaCode, sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return { success: false, error: 'session_expired', message: 'Session expired. Please fetch a new CAPTCHA.' };
    }
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        return { success: false, error: 'session_expired', message: 'Session expired (10 min TTL). Please fetch a new CAPTCHA.' };
    }

    const portal = PORTALS[session.courtType];
    const cnrClean = cnr.trim().toUpperCase();
    const captchaClean = captchaCode.trim();

    console.log(`🔍 [searchByCNR] CNR="${cnrClean}" CAPTCHA="${captchaClean}" on ${portal.name}`);
    console.log(`   Using cookies: ${cookieString(session.cookies).substring(0, 120)}...`);

    // ── POST searchByCNR with same session cookies ───────────────────────
    const body = new URLSearchParams({
        cino: cnrClean,
        fcaptcha_code: captchaClean,
        ajax_req: 'true',
        app_token: '',
    }).toString();

    console.log(`   POST body: ${body}`);

    const res = await axios.post(
        portal.base + portal.searchEndpoint,
        body,
        {
            headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': portal.base,
                'Origin': portal.origin,
                'Cookie': cookieString(session.cookies),
                'Accept': 'application/json, text/javascript, */*; q=0.01',
            },
            validateStatus: () => true,
            timeout: 30000,
        }
    );

    // Clean up session (one-time use)
    sessions.delete(sessionId);

    console.log(`   HTTP ${res.status} — ${typeof res.data === 'string' ? res.data.length : JSON.stringify(res.data).length} chars`);

    // ── Parse the response ───────────────────────────────────────────────
    let data = res.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { /* raw HTML */ }
    }

    // Save raw response for debugging
    try {
        fs.writeFileSync(
            path.join(__dirname, '..', 'last_ecourts_response.json'),
            typeof data === 'string' ? data : JSON.stringify(data, null, 2),
            'utf8'
        );
    } catch (e) { /* ignore */ }

    // Check for errors in response
    const result = extractHtmlFromResponse(data);
    if (result.error) {
        console.log(`   ❌ ${result.error.error}: ${result.error.message}`);
        return result.error;
    }

    const html = result.html;
    if (!html || html.length < 50) {
        console.error('   ❌ Response HTML too short:', html?.substring(0, 200));
        return { success: false, error: 'empty_response', message: 'No case data returned from eCourts.' };
    }

    // Save raw HTML
    try {
        fs.writeFileSync(path.join(__dirname, '..', 'last_ecourts_response.html'), html, 'utf8');
    } catch (e) { /* ignore */ }

    // Parse into structured data
    console.log(`   🔧 Parsing ${html.length} chars of HTML...`);
    const caseData = parseCaseHTML(html, cnrClean, session.courtType, portal);
    console.log(`   ✅ Parsed: "${caseData.title}" — ${caseData.hearings.length} hearings, ${caseData.orders?.length || 0} orders`);

    return { success: true, data: caseData };
}

// ═══════════════════════════════════════════════
// extractHtmlFromResponse
// ═══════════════════════════════════════════════
function extractHtmlFromResponse(data) {
    if (typeof data === 'object' && data !== null) {
        const errormsg = String(data.errormsg || data.error || data.msg || '').toLowerCase();

        // Check for real data even if errormsg is present
        const hasRealData = (data.history_cnr && data.history_cnr.length > 100) ||
            (data.ct_case_status && data.ct_case_status.length > 100) ||
            (data.historytable && data.historytable.length > 100) ||
            (data.casetype_list && data.casetype_list.length > 100);

        if (hasRealData) {
            console.log(`   ℹ️  errormsg="${data.errormsg || ''}" but real data found — proceeding.`);
        } else {
            if (errormsg.includes('invalid captcha') || errormsg.includes('captcha not match')) {
                return { error: { success: false, error: 'invalid_captcha', message: 'Invalid CAPTCHA. Please try again.' } };
            }
            if (errormsg.includes('invalid cnr') || errormsg.includes('record not found') || errormsg.includes('no record')) {
                return { error: { success: false, error: 'invalid_cnr', message: 'Invalid CNR or no records found.' } };
            }
            if (data.div_captcha && !data.history_cnr && !data.ct_case_status && !data.casetype_list) {
                return { error: { success: false, error: 'invalid_captcha', message: 'CAPTCHA validation failed. Please fetch a new CAPTCHA.' } };
            }
        }

        // Build HTML from all available fragments
        const fragments = [
            data.ct_case_status || '',
            data.casetype_list || '',
            data.history_cnr || '',
            data.historytable || '',
            data.pdflist || '',
            data.html || '',
            data.data || '',
        ].filter(f => f && f.length > 0);

        if (fragments.length > 0) {
            return { html: fragments.join('\n') };
        }

        console.warn('   ⚠️  Unexpected JSON keys:', Object.keys(data).join(', '));
        return { html: JSON.stringify(data) };
    }

    if (typeof data === 'string') {
        const low = data.toLowerCase();
        if (low.includes('invalid captcha')) {
            return { error: { success: false, error: 'invalid_captcha', message: 'Invalid CAPTCHA.' } };
        }
        if (low.includes('invalid cnr') || low.includes('record not found')) {
            return { error: { success: false, error: 'invalid_cnr', message: 'Invalid CNR or no records found.' } };
        }
        return { html: data };
    }

    return { error: { success: false, error: 'unknown_response', message: 'Unrecognised response from eCourts.' } };
}

// ═══════════════════════════════════════════════
// parseCaseHTML
// ═══════════════════════════════════════════════
function parseCaseHTML(html, cnr, courtType = 'district', portal = null) {
    const $ = cheerio.load(html);
    const ecourtsCodes = require('../data/ecourts-codes.json');
    const portalCfg = portal || PORTALS[courtType];

    // ── Metadata ──────────────────────────────────────────────────────────
    let title = '', caseType = '', filedDate = '', registrationDate = '';
    let court = '', district = '', petitioner = '', respondent = '';
    let petitionerAdvocate = '', respondentAdvocate = '', caseStatus = '';
    let nextHearingDate = '', firstHearingDate = '', caseStageExplicit = '';
    let nextHearingPurpose = '';

    // Helper: extract text and strip ordinals ("22nd August 2016" → clean value)
    function cleanCellText($cell) {
        return $cell.text().trim().replace(/\u00a0/g, '').trim();
    }

    // Parse ALL tables (case_details_table AND case_status_table)
    $('table').each((_, table) => {
        const tableClass = $(table).attr('class') || '';
        if (tableClass.includes('history_table') || tableClass.includes('order_table') || tableClass.includes('transfer_table') || tableClass.includes('acts_table') || tableClass.includes('FIR_details_table')) return;

        $(table).find('tr').each((_, tr) => {
            const cells = $(tr).find('td, th');

            // Handle rows with 4 cells: th td th td (e.g. Filing Number | date | Registration Number | date)
            if (cells.length >= 4) {
                for (let i = 0; i + 1 < cells.length; i += 2) {
                    const nodeType = cells[i].name;
                    if (nodeType !== 'th') continue;
                    const label = $(cells[i]).text().trim().toLowerCase().replace(/[\s:]+/g, ' ').trim();
                    const value = cleanCellText($(cells[i + 1]));
                    if (!value || value === '-') continue;
                    if (label.includes('case type')) caseType = caseType || value;
                    if (label.includes('filing date') || label.includes('date of filing')) filedDate = filedDate || value;
                    if (label.includes('registration date') || label.includes('date of registration')) registrationDate = registrationDate || value;
                    if (label.includes('first hearing date')) firstHearingDate = firstHearingDate || value;
                    if (label.includes('next hearing') || label.includes('next date')) nextHearingDate = nextHearingDate || value;
                    if (label.includes('case stage')) caseStageExplicit = caseStageExplicit || value;
                    if (label.includes('case status') || label === 'status') caseStatus = caseStatus || value;
                    if ((label.includes('court') && label.includes('number') && !label.includes('cnr')) || label.includes('court number and judge'))
                        court = court || value;
                    if (label.includes('district') && !label.includes('court')) district = district || value;
                }
                return; // skip the 2-cell path
            }

            // Normal 2-cell rows: th td (used by case_status_table)
            if (cells.length < 2) return;
            const label = $(cells[0]).text().trim().toLowerCase().replace(/[\s:]+/g, ' ').trim();
            const value = cleanCellText($(cells[1]));
            if (!value || value === '-') return;

            if (label.includes('case type')) caseType = caseType || value;
            if (label.includes('filing date') || label.includes('date of filing')) filedDate = filedDate || value;
            if (label.includes('registration date') || label.includes('date of registration')) registrationDate = registrationDate || value;
            if (label.includes('first hearing date')) firstHearingDate = firstHearingDate || value;
            if (label.includes('next hearing') || label.includes('next date')) nextHearingDate = nextHearingDate || value;
            if (label.includes('case stage')) caseStageExplicit = caseStageExplicit || value;
            if (label.includes('case status') || label === 'status') caseStatus = caseStatus || value;
            if ((label.includes('court') && label.includes('number') && !label.includes('cnr')) || label.includes('court number and judge'))
                court = court || value;
            if (label.includes('district') && !label.includes('court')) district = district || value;
        });
    });

    console.log(`   📋 Parsed: caseStage="${caseStageExplicit}", nextHearing="${nextHearingDate}", firstHearing="${firstHearingDate}", court="${court}"`);

    // ── Petitioner / Respondent ───────────────────────────────────────────
    const petList = $('.Petitioner_Advocate_table, .petitioner-advocate-list');
    if (petList.length) {
        const text = petList.text().trim();
        const partyMatch = text.match(/\d+\)\s*(.+?)(?:\n|Advocate)/i);
        if (partyMatch) petitioner = petitioner || partyMatch[1].trim();
        const advMatch = text.match(/Advocate-?\s*(.+?)(?:\n|$)/i);
        if (advMatch) petitionerAdvocate = petitionerAdvocate || advMatch[1].trim();
    }
    const respList = $('.Respondent_Advocate_table, .respondent-advocate-list');
    if (respList.length) {
        const text = respList.text().trim();
        const partyMatch = text.match(/\d+\)\s*(.+?)(?:\n|Advocate|$)/i);
        if (partyMatch) respondent = respondent || partyMatch[1].trim();
        const advMatch = text.match(/Advocate-?\s*(.+?)(?:\n|$)/i);
        if (advMatch) respondentAdvocate = respondentAdvocate || advMatch[1].trim();
    }

    // ── Title ─────────────────────────────────────────────────────────────
    const allText = $.text();
    const vsMatch = allText.match(/([^\n]{3,80}?)\s+(?:vs\.?|v\/s|versus)\s+([^\n]{3,80})/i);
    if (vsMatch) {
        title = title || vsMatch[0].trim().substring(0, 120);
        petitioner = petitioner || vsMatch[1].trim();
        respondent = respondent || vsMatch[2].trim();
    }
    if (!title && petitioner && respondent) {
        title = `${petitioner} Vs ${respondent}`;
    }

    // ── Hearing history ──────────────────────────────────────────────────
    const hearings = [];
    const hearingTable = $('.history_table');
    if (hearingTable.length) {
        const rows = hearingTable.find('tbody tr');
        const dataRows = rows.length > 0 ? rows : hearingTable.find('tr').slice(1);

        dataRows.each((j, tr) => {
            const cells = $(tr).find('td');
            if (cells.length < 4) return;

            const judge = $(cells[0]).text().trim();
            const businessOnDate = $(cells[1]).text().trim();
            const hearingDate = $(cells[2]).text().trim();
            const purpose = $(cells[3]).text().trim();

            const hearing = {
                id: j + 1,
                judge,
                businessOnDate,
                business: purpose,
                businessTranslated: purpose,
                date: hearingDate,
                purpose,
                classification: classifyHearing(purpose),
                orderPdfUrl: null,
            };

            const purposeUpper = purpose.toUpperCase().trim();
            if (ecourtsCodes.businessCodes?.[purposeUpper]?.plain) {
                hearing.businessTranslated = ecourtsCodes.businessCodes[purposeUpper].plain;
            }

            if (hearingDate || businessOnDate) hearings.push(hearing);
        });
    }

    // ── Orders ────────────────────────────────────────────────────────────
    const orders = [];
    const orderTable = $('.order_table');
    if (orderTable.length) {
        const rows = orderTable.find('tbody tr');
        const dataRows = rows.length > 0 ? rows : orderTable.find('tr').slice(1);

        dataRows.each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length < 2) return;

            const orderNumber = $(cells[0]).text().trim();
            const orderDate = $(cells[1]).text().trim();
            let pdfUrl = null;
            let orderDetails = '';

            $(tr).find('a').each((__, a) => {
                const onclick = $(a).attr('onclick') || '';
                const dpMatch = onclick.match(/displayPdf\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/);
                if (dpMatch) pdfUrl = buildPdfUrl(portalCfg, dpMatch[1], dpMatch[2], dpMatch[3], dpMatch[4]);
                const linkText = $(a).text().trim();
                if (linkText) orderDetails = orderDetails || linkText;
            });

            if (orderNumber || orderDate) {
                orders.push({ number: parseInt(orderNumber, 10) || orders.length + 1, date: orderDate, details: orderDetails || 'Copy of order', pdfUrl });
            }
        });
    }

    // ── Cross-reference orders → hearings ─────────────────────────────────
    for (const order of orders) {
        if (!order.pdfUrl || !order.date) continue;
        const oNorm = normalizeDate(order.date);
        if (!oNorm) continue;
        for (const h of hearings) {
            if (normalizeDate(h.businessOnDate) === oNorm || normalizeDate(h.date) === oNorm) {
                h.orderPdfUrl = order.pdfUrl;
                break;
            }
        }
    }

    // ── Acts ──────────────────────────────────────────────────────────────
    const acts = [];
    const actTable = $('#act_table');
    if (actTable.length) {
        actTable.find('tr').slice(1).each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length >= 2) acts.push({ act: $(cells[0]).text().trim(), section: $(cells[1]).text().trim() });
        });
    }

    // ── Transfers ─────────────────────────────────────────────────────────
    const transfers = [];
    const transferTable = $('.transfer_table');
    if (transferTable.length) {
        transferTable.find('tbody tr, tr').slice(1).each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length >= 4) {
                transfers.push({ regNumber: $(cells[0]).text().trim(), date: $(cells[1]).text().trim(), fromCourt: $(cells[2]).text().trim(), toCourt: $(cells[3]).text().trim() });
            }
        });
    }

    // ── Stage detection ──────────────────────────────────────────────────
    let currentStageCode = '', currentStage = 1;
    const stagePatterns = [
        { pattern: /judgment|disposed|decreed|decree|dismissed|allowed|settled/i, code: 'JUD', stage: 8 },
        { pattern: /final.*argument|argument/i, code: 'ARG', stage: 7 },
        { pattern: /defendant.*evidence/i, code: 'DE', stage: 6 },
        { pattern: /plai?ntiff.*evidence/i, code: 'PE', stage: 5 },
        { pattern: /further.*order|consideration|lok.*adalat|mediation|settlement/i, code: 'FO', stage: 5 },
        { pattern: /framing.*issue|issue.*fram/i, code: 'FRA', stage: 4 },
        { pattern: /written\s*statement|replica/i, code: 'WS', stage: 3 },
        { pattern: /notice|service|summon/i, code: 'NOTICE', stage: 3 },
        { pattern: /admission|appearance/i, code: 'ADM', stage: 2 },
        { pattern: /filing|registered/i, code: 'FIL', stage: 1 },
    ];
    // Use caseStageExplicit first (from Case Stage row), then last hearing purpose, then caseStatus
    const stageText = (caseStageExplicit || '').toLowerCase();
    const stageTextFallback = (hearings[0]?.purpose || caseStatus || '').toLowerCase();
    for (const sp of stagePatterns) {
        if (sp.pattern.test(stageText)) { currentStageCode = sp.code; currentStage = sp.stage; break; }
    }
    // If no match from caseStageExplicit, try hearing purpose
    if (!currentStageCode) {
        for (const sp of stagePatterns) {
            if (sp.pattern.test(stageTextFallback)) { currentStageCode = sp.code; currentStage = sp.stage; break; }
        }
    }
    console.log(`   📊 Stage detection: stageText="${stageText || stageTextFallback}" → stage=${currentStage} (${currentStageCode})`);

    nextHearingPurpose = hearings[0]?.purpose || caseStageExplicit || '';
    if (!nextHearingDate) {
        const m = allText.match(/next\s*(?:hearing\s*)?date\s*[:.]?\s*(\d{1,2}[\-\.\/]\d{1,2}[\-\.\/]\d{2,4})/i);
        if (m) nextHearingDate = m[1];
    }

    const stateMap = { 'MH': 'Maharashtra', 'DL': 'Delhi', 'UP': 'Uttar Pradesh', 'KA': 'Karnataka', 'TN': 'Tamil Nadu', 'RJ': 'Rajasthan', 'GJ': 'Gujarat', 'WB': 'West Bengal', 'MP': 'Madhya Pradesh', 'AP': 'Andhra Pradesh', 'TS': 'Telangana', 'KL': 'Kerala', 'PB': 'Punjab', 'HR': 'Haryana', 'BR': 'Bihar', 'JH': 'Jharkhand', 'AS': 'Assam', 'OR': 'Odisha', 'CG': 'Chhattisgarh', 'GA': 'Goa', 'HP': 'Himachal Pradesh', 'UK': 'Uttarakhand', 'JK': 'Jammu and Kashmir' };
    const stateCode = cnr.length >= 2 ? cnr.substring(0, 2).toUpperCase() : '';
    const derivedState = stateMap[stateCode] || stateCode;
    const finalDistrict = district || (cnr.length >= 4 ? cnr.substring(2, 4).toUpperCase() : '');

    return {
        cnr: cnr.toUpperCase(),
        title: title || `Case ${cnr}`,
        caseType: caseType || 'Unknown',
        court: court || (courtType === 'highcourt' ? 'High Court' : 'District Court'),
        state: derivedState,
        district: finalDistrict,
        'Filing Date': filedDate || '-',
        filedDate: filedDate || '-',
        registrationDate: registrationDate || '',
        firstHearingDate: firstHearingDate || '',
        decisionDate: '',
        caseStatus: caseStatus || '',
        caseStageExplicit: caseStageExplicit || '',
        currentStageCode, currentStage, totalStages: 8,
        nextHearingDate, nextHearingPurpose,
        petitioner: petitioner || 'Unknown',
        petitionerAdvocate: petitionerAdvocate || 'Unknown',
        respondent: respondent || 'Unknown',
        respondentAdvocate: respondentAdvocate || 'Unknown',
        acts, firDetails: null, hearings, orders, transfers,
        source: `ecourts_live_${courtType}`,
        cachedAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const s = dateStr.replace(/[\u00a0]/g, ' ').trim();
    // Standard DD-MM-YYYY or DD/MM/YYYY
    const m = s.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
    if (m) return `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}-${m[3]}`;
    // Ordinal dates: "22nd August 2016", "31st July 2026", "1st January 2020"
    const months = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
    const ordM = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (ordM && months[ordM[2].toLowerCase()]) {
        return `${ordM[1].padStart(2, '0')}-${months[ordM[2].toLowerCase()]}-${ordM[3]}`;
    }
    return null;
}

function parseDateToMs(normalizedDate) {
    if (!normalizedDate) return null;
    const [dd, mm, yyyy] = normalizedDate.split('-');
    return new Date(`${yyyy}-${mm}-${dd}`).getTime() || null;
}

function buildPdfUrl(portal, normalV, caseVal, courtCode, filename) {
    if (!portal || !filename) return null;
    const base = portal.pdfBase || portal.base;
    return `ecourts-pdf://${base}|${normalV}|${caseVal}|${courtCode}|${filename}`;
}

function classifyHearing(purpose) {
    const p = (purpose || '').toLowerCase().trim();

    // ── CLEARLY ADJOURNED (eCourts explicitly says case was postponed) ──
    if (/^adj$|^adjourned$/i.test(p)) return 'adjourned_other';
    if (/further.*order|^fo$/i.test(p)) return 'adjourned_other';
    if (/nnfr|not.*fixed|not.*taken.*up|heavy.*board/i.test(p)) return 'adjourned_court';
    if (/s\/o|standing.*over|postpone/i.test(p)) return 'adjourned_other';
    if (/judge.*leave|court.*holiday|vacation|sine.*die/i.test(p)) return 'adjourned_court';
    if (/covid/i.test(p)) return 'adjourned_court';
    if (/advocate.*absent|counsel.*absent|lawyer.*absent/i.test(p)) return 'adjourned_lawyer';
    if (/advocate.*request|counsel.*request/i.test(p)) return 'adjourned_lawyer';
    if (/adjourned/i.test(p)) return 'adjourned_other'; // catch-all for any "adjourned" text

    // ── CLEARLY PRODUCTIVE (eCourts says case moved forward) ──
    if (/appearance/i.test(p)) return 'productive';
    if (/^heard$|part.*heard/i.test(p)) return 'productive';
    if (/plai?ntiff.*evidence|plaintiff\s*ex/i.test(p)) return 'productive';
    if (/defendant.*evidence|defendant\s*ex/i.test(p)) return 'productive';
    if (/cross.*exam|examination/i.test(p)) return 'productive';
    if (/argument|final.*arg/i.test(p)) return 'productive';
    if (/judgment|decree|disposed|dismissed|allowed|settled/i.test(p)) return 'productive';
    if (/written.*statement/i.test(p)) return 'productive';
    if (/framing.*issue|issue.*fram/i.test(p)) return 'productive';
    if (/exhibit/i.test(p)) return 'productive';
    if (/^evidence$|for.*evidence/i.test(p)) return 'productive';
    if (/notice/i.test(p)) return 'productive';
    if (/admission|cognizance|charge/i.test(p)) return 'productive';

    // ── UNKNOWN — we don't have enough info to classify ──
    return 'unknown';
}
function cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
    }
}

// ═══════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════
module.exports = {
    fetchCaptcha,
    searchByCNR,
    parseCaseHTML,
    classifyHearing,
    buildPdfUrl,
    PORTALS,
    sessions,
};
