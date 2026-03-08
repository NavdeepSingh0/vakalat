/**
 * PDF Routes — Phase P-1 / P-2 / P-3
 *
 * Handles downloading, extracting, and summarising court order PDFs from eCourts.
 *
 * Mount in server.js:
 *   const pdfRoutes = require('./routes/pdfRoutes');
 *   app.use('/api/order', pdfRoutes);
 *
 * Endpoints:
 *   GET  /api/order/:cnr/:hearingId/download  → streams the PDF to client
 *   GET  /api/order/:cnr/:hearingId/text      → returns extracted plain text
 *   GET  /api/order/:cnr/:hearingId/summary   → returns Gemini plain-English summary
 *   GET  /api/order/:cnr/:hearingId/actions   → returns deadlines + action items
 *
 * How PDF URLs work:
 *   ecourts.js stores order PDF references as:
 *     ecourts-pdf://<pdfBase>|<encryptedToken>|<filename>
 *
 *   This route parses that URI and POSTs to eCourts' generatePdf endpoint
 *   using the session cookies from the original CAPTCHA session.
 *
 *   Because the session cookie may have expired by the time the user clicks
 *   "Download", we accept an optional ?sessionId= query param. If omitted,
 *   we fall back to a direct GET on the token URL (works for some HC orders).
 */

const express = require('express');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const router = express.Router();

// ── Shared session store (same Map used in ecourts.js) ─────────────────────
// We import it from ecourts.js rather than duplicating it.
// If your project structure differs, adjust the path.
const { PORTALS } = require('../services/ecourts');

// ── In-memory cache for extracted text + summaries ─────────────────────────
// Keyed by "cnr:hearingId"
// In production, swap this for Firestore writes (Phase P-2 stores to Firestore)
const textCache = new Map();
const summaryCache = new Map();

// ── Session store reference ─────────────────────────────────────────────────
// ecourts.js exports its sessions Map so we can reuse it here.
// If it doesn't yet, add `module.exports.sessions = sessions;` to ecourts.js
// and import it:  const { sessions } = require('../services/ecourts');
// For now we fall back gracefully if no session is available.
let sessions;
try {
    ({ sessions } = require('../services/ecourts'));
} catch (_) {
    sessions = new Map();
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: parse an ecourts-pdf:// URI  (REWRITTEN for 5-arg displayPdf format)
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {string} pdfUrl  e.g. "ecourts-pdf://https://services.ecourts.gov.in/ecourtindia_v6/|normal_v|case_val|court_code|filename"
 * @returns {{ pdfBase, normalV, caseVal, courtCode, filename } | null}
 */
function parsePdfUri(pdfUrl) {
    if (!pdfUrl || !pdfUrl.startsWith('ecourts-pdf://')) return null;
    const raw = pdfUrl.replace('ecourts-pdf://', '');
    const parts = raw.split('|');
    if (parts.length < 5) return null;
    return {
        pdfBase: parts[0],
        normalV: parts[1],
        caseVal: parts[2],
        courtCode: parts[3],
        filename: parts[4],
    };
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: fetch PDF buffer from eCourts  (REWRITTEN for confirmed 2-step flow)
// ════════════════════════════════════════════════════════════════════════════
/**
 * Step 1: POST to /?p=home/display_pdf with the 5 displayPdf args
 *         Returns JSON: {"order":"reports/xxx.pdf"}
 * Step 2: GET the relative PDF path from the base URL
 *         Returns actual PDF binary
 *
 * Confirmed from DevTools:
 *   POST fields: normal_v, case_val, court_code, filename, appFlag, ajax_req, app_token
 *   Cookies needed: SERVICES_SESSID, ext_name, JSESSION
 */
async function fetchPdfBuffer(pdfBase, normalV, caseVal, courtCode, filename, cookieString) {
    const isHighCourt = pdfBase.includes('hcservices');

    if (isHighCourt) {
        // High Court: may use a different mechanism — keep existing fallback
        const url = `${pdfBase}viewfile.php?filename=${encodeURIComponent(filename)}`;
        console.log(`   📄 HC PDF GET → ${url}`);
        const resp = await axios.get(url, {
            headers: buildHeaders(pdfBase, cookieString),
            responseType: 'arraybuffer',
            timeout: 30000,
        });
        return Buffer.from(resp.data);
    }

    // District Court: 2-step flow
    // Step 1: POST to display_pdf to get the relative PDF path
    const displayUrl = `${pdfBase}?p=home/display_pdf`;
    const params = new URLSearchParams();
    params.append('normal_v', normalV);
    params.append('case_val', caseVal);
    params.append('court_code', courtCode);
    params.append('filename', filename);
    params.append('appFlag', '');
    params.append('ajax_req', 'true');
    params.append('app_token', '');

    console.log(`   📄 District PDF POST → ${displayUrl}`);
    const step1 = await axios.post(displayUrl, params.toString(), {
        headers: {
            ...buildHeaders(pdfBase, cookieString),
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        timeout: 20000,
    });

    // Response should be JSON: {"order":"reports/xxx.pdf"}
    let relativePath;
    if (typeof step1.data === 'object' && step1.data.order) {
        relativePath = step1.data.order;
    } else if (typeof step1.data === 'string') {
        try {
            const json = JSON.parse(step1.data);
            relativePath = json.order;
        } catch (e) {
            throw new Error(`display_pdf returned non-JSON: ${String(step1.data).substring(0, 100)}`);
        }
    }

    if (!relativePath) {
        throw new Error(`display_pdf did not return an order path: ${JSON.stringify(step1.data).substring(0, 200)}`);
    }

    // Step 2: GET the actual PDF binary
    const pdfUrl = `${pdfBase}${relativePath}`;
    console.log(`   📄 District PDF GET → ${pdfUrl}`);
    const step2 = await axios.get(pdfUrl, {
        headers: buildHeaders(pdfBase, cookieString),
        responseType: 'arraybuffer',
        timeout: 30000,
    });

    const buf = Buffer.from(step2.data);

    // eCourts sometimes returns an HTML error page instead of a PDF
    if (buf.slice(0, 5).toString() !== '%PDF-') {
        const preview = buf.slice(0, 200).toString('utf8');
        if (preview.toLowerCase().includes('session') || preview.toLowerCase().includes('captcha')) {
            throw new Error('SESSION_EXPIRED');
        }
        throw new Error(`eCourts returned non-PDF content: ${preview.substring(0, 80)}`);
    }

    return buf;
}

function buildHeaders(referer, cookieString) {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer,
        ...(cookieString ? { 'Cookie': cookieString } : {}),
    };
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: get cookie string from session store
// ════════════════════════════════════════════════════════════════════════════
function getCookies(sessionId) {
    if (!sessionId || !sessions) return '';
    const session = sessions.get(sessionId);
    return session?.cookies || '';
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: get pdfUrl for a hearing from Firestore / in-memory
// ════════════════════════════════════════════════════════════════════════════
/**
 * Looks up the stored ecourts-pdf:// URI for a specific hearing.
 * Tries Firestore first, then falls back to a directly-passed ?pdfUrl= param.
 *
 * In a real deployment this reads from Firestore cases/{cnr}.hearings[hearingId].orderPdfUrl
 * For now we accept it as a query param so the feature works without Firestore.
 */
async function resolvePdfUrl(cnr, hearingId, queryPdfUrl) {
    // If caller passed the URL directly (e.g. from frontend state), use it
    if (queryPdfUrl && queryPdfUrl.startsWith('ecourts-pdf://')) {
        return queryPdfUrl;
    }

    // Try Firestore
    try {
        const admin = require('firebase-admin');
        const db = admin.firestore();
        const doc = await db.collection('cases').doc(cnr.toUpperCase()).get();
        if (doc.exists) {
            const hearings = doc.data()?.hearings || [];
            // hearingId is 1-based index stored during parsing
            const hearing = hearings.find(h => String(h.id) === String(hearingId));
            if (hearing?.orderPdfUrl) return hearing.orderPdfUrl;
        }
    } catch (_) {
        // Firestore not initialised (demo mode) — fall through
    }

    return null;
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/order/:cnr/:hearingId/download
// ════════════════════════════════════════════════════════════════════════════
/**
 * Streams the PDF to the client.
 *
 * Query params:
 *   sessionId  (optional) — the session from /api/captcha, used for cookies
 *   pdfUrl     (optional) — the ecourts-pdf:// URI, if client already has it
 *
 * Example:
 *   GET /api/order/MHAU0100012342020/3/download?sessionId=sess_xxx&pdfUrl=ecourts-pdf://...
 */
router.get('/:cnr/:hearingId/download', async (req, res) => {
    const { cnr, hearingId } = req.params;
    const { sessionId, pdfUrl: queryPdfUrl } = req.query;

    console.log(`📥 PDF download: CNR=${cnr}, hearing=${hearingId}`);

    try {
        const pdfUrl = await resolvePdfUrl(cnr, hearingId, queryPdfUrl);

        if (!pdfUrl) {
            return res.status(404).json({
                success: false,
                error: 'pdf_not_found',
                message: 'No PDF URL found for this hearing. The order may not have been uploaded to eCourts yet.',
            });
        }

        const parsed = parsePdfUri(pdfUrl);
        if (!parsed) {
            return res.status(400).json({
                success: false,
                error: 'invalid_pdf_url',
                message: 'Malformed PDF reference stored for this hearing.',
            });
        }

        const cookies = getCookies(sessionId);
        if (!cookies) {
            console.warn('   ⚠️  No session cookies — attempting without auth (may fail for District Court)');
        }

        const pdfBuffer = await fetchPdfBuffer(parsed.pdfBase, parsed.normalV, parsed.caseVal, parsed.courtCode, parsed.filename, cookies);

        // Cache the raw buffer for text extraction later
        const cacheKey = `${cnr}:${hearingId}`;
        if (!textCache.has(cacheKey)) {
            // Extract text in the background — don't block the download
            extractAndCacheText(cacheKey, pdfBuffer).catch(e =>
                console.warn(`   ⚠️  Background text extraction failed: ${e.message}`)
            );
        }

        // Stream PDF to client
        const safeFilename = parsed.filename || `order_${cnr}_${hearingId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('❌ PDF download error:', err.message);

        if (err.message === 'SESSION_EXPIRED') {
            return res.status(401).json({
                success: false,
                error: 'session_expired',
                message: 'Your eCourts session has expired. Please fetch a new CAPTCHA and search the case again.',
            });
        }
        res.status(500).json({
            success: false,
            error: 'download_failed',
            message: `Could not download PDF: ${err.message}`,
        });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/order/:cnr/:hearingId/text  — Phase P-2
// ════════════════════════════════════════════════════════════════════════════
/**
 * Returns the extracted plain text of a court order PDF.
 * Downloads + extracts if not already cached.
 *
 * Query params: same as /download
 */
router.get('/:cnr/:hearingId/text', async (req, res) => {
    const { cnr, hearingId } = req.params;
    const { sessionId, pdfUrl: queryPdfUrl } = req.query;
    const cacheKey = `${cnr}:${hearingId}`;

    console.log(`📝 PDF text: CNR=${cnr}, hearing=${hearingId}`);

    try {
        // Return from cache if available
        if (textCache.has(cacheKey)) {
            return res.json({ success: true, cnr, hearingId, text: textCache.get(cacheKey), cached: true });
        }

        // Download and extract
        const pdfUrl = await resolvePdfUrl(cnr, hearingId, queryPdfUrl);
        if (!pdfUrl) {
            return res.status(404).json({ success: false, error: 'pdf_not_found', message: 'No PDF found for this hearing.' });
        }

        const parsed = parsePdfUri(pdfUrl);
        const cookies = getCookies(sessionId);
        const pdfBuffer = await fetchPdfBuffer(parsed.pdfBase, parsed.normalV, parsed.caseVal, parsed.courtCode, parsed.filename, cookies);
        const text = await extractAndCacheText(cacheKey, pdfBuffer);

        res.json({ success: true, cnr, hearingId, text, cached: false });

    } catch (err) {
        console.error('❌ PDF text error:', err.message);
        res.status(500).json({ success: false, error: 'extraction_failed', message: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/order/:cnr/:hearingId/summary  — Phase P-3
// ════════════════════════════════════════════════════════════════════════════
/**
 * Returns a plain-English Gemini summary of a court order.
 * Caches result — only calls Gemini once per order.
 *
 * Requires GEMINI_API_KEY in environment.
 */
router.get('/:cnr/:hearingId/summary', async (req, res) => {
    const { cnr, hearingId } = req.params;
    const { sessionId, pdfUrl: queryPdfUrl } = req.query;
    const cacheKey = `${cnr}:${hearingId}`;

    console.log(`🤖 PDF summary: CNR=${cnr}, hearing=${hearingId}`);

    try {
        // Return cached summary
        if (summaryCache.has(cacheKey)) {
            return res.json({ success: true, cnr, hearingId, ...summaryCache.get(cacheKey), cached: true });
        }

        // Get text (from cache or by downloading)
        let text = textCache.get(cacheKey);
        if (!text) {
            const pdfUrl = await resolvePdfUrl(cnr, hearingId, queryPdfUrl);
            if (!pdfUrl) return res.status(404).json({ success: false, error: 'pdf_not_found' });

            const parsed = parsePdfUri(pdfUrl);
            const cookies = getCookies(sessionId);
            const pdfBuffer = await fetchPdfBuffer(parsed.pdfBase, parsed.normalV, parsed.caseVal, parsed.courtCode, parsed.filename, cookies);
            text = await extractAndCacheText(cacheKey, pdfBuffer);
        }

        if (!text || text.trim().length < 20) {
            return res.status(422).json({
                success: false,
                error: 'no_text',
                message: 'Could not extract readable text from this PDF. It may be a scanned image.',
            });
        }

        // Call Gemini Flash
        const { summary, actions, deadlines, nextHearingPurpose } = await callGemini(text, cnr);

        const result = {
            summary,
            actions,
            deadlines,
            nextHearingPurpose,
            generatedAt: new Date().toISOString(),
        };

        summaryCache.set(cacheKey, result);

        // Persist to Firestore in background
        persistToFirestore(cnr, hearingId, { orderText: text, orderSummary: result }).catch(() => { });

        res.json({ success: true, cnr, hearingId, ...result, cached: false });

    } catch (err) {
        console.error('❌ PDF summary error:', err.message);
        res.status(500).json({ success: false, error: 'summary_failed', message: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/order/:cnr/:hearingId/actions  — Phase P-4
// ════════════════════════════════════════════════════════════════════════════
/**
 * Returns structured action items and deadlines extracted from the order.
 * Reuses the summary cache — no extra Gemini call if summary already ran.
 */
router.get('/:cnr/:hearingId/actions', async (req, res) => {
    const { cnr, hearingId } = req.params;
    const { sessionId, pdfUrl: queryPdfUrl } = req.query;
    const cacheKey = `${cnr}:${hearingId}`;

    try {
        // Piggyback on summary cache
        if (summaryCache.has(cacheKey)) {
            const cached = summaryCache.get(cacheKey);
            return res.json({
                success: true,
                cnr,
                hearingId,
                actions: cached.actions || [],
                deadlines: cached.deadlines || [],
                nextHearingPurpose: cached.nextHearingPurpose || '',
                cached: true,
            });
        }

        // Trigger full summary generation (which also extracts actions)
        // Redirect internally by forwarding to the summary handler logic
        // (simplest approach: just call it and pluck the action fields)
        let text = textCache.get(cacheKey);
        if (!text) {
            const pdfUrl = await resolvePdfUrl(cnr, hearingId, queryPdfUrl);
            if (!pdfUrl) return res.status(404).json({ success: false, error: 'pdf_not_found' });

            const parsed = parsePdfUri(pdfUrl);
            const cookies = getCookies(sessionId);
            const pdfBuffer = await fetchPdfBuffer(parsed.pdfBase, parsed.normalV, parsed.caseVal, parsed.courtCode, parsed.filename, cookies);
            text = await extractAndCacheText(cacheKey, pdfBuffer);
        }

        const { actions, deadlines, nextHearingPurpose, summary } = await callGemini(text, cnr);
        summaryCache.set(cacheKey, { summary, actions, deadlines, nextHearingPurpose, generatedAt: new Date().toISOString() });

        res.json({ success: true, cnr, hearingId, actions, deadlines, nextHearingPurpose, cached: false });

    } catch (err) {
        console.error('❌ PDF actions error:', err.message);
        res.status(500).json({ success: false, error: 'actions_failed', message: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// Internal: extract text and cache it
// ════════════════════════════════════════════════════════════════════════════
async function extractAndCacheText(cacheKey, pdfBuffer) {
    const parsed = await pdfParse(pdfBuffer);
    const text = parsed.text?.trim() || '';
    textCache.set(cacheKey, text);
    console.log(`   📝 Extracted ${text.length} chars of text, cached as "${cacheKey}"`);
    return text;
}

// ════════════════════════════════════════════════════════════════════════════
// Internal: call Gemini Flash for summary + action extraction
// ════════════════════════════════════════════════════════════════════════════
async function callGemini(text, cnr) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment.');

    // Truncate to ~6000 chars to stay within token limits comfortably
    const truncated = text.length > 6000 ? text.substring(0, 6000) + '\n[text truncated]' : text;

    const prompt = `
You are a legal assistant helping ordinary Indian citizens understand court orders.

Below is the text of a court order from an Indian court (CNR: ${cnr}).

Your task:
1. Write a SUMMARY in plain English (3-5 sentences). Assume the reader has no legal knowledge. 
   Explain: what happened in court today, what was decided, and what it means for each side.
2. List ACTIONS — specific things each party must now do (max 5 bullet points).
3. List DEADLINES — any specific dates or timeframes mentioned (max 5 bullet points).
4. State the NEXT_HEARING_PURPOSE — in one short sentence, what will happen at the next hearing.

Respond ONLY with valid JSON in this exact format, no markdown, no preamble:
{
  "summary": "...",
  "actions": ["...", "..."],
  "deadlines": ["...", "..."],
  "nextHearingPurpose": "..."
}

Court order text:
${truncated}
`.trim();

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        },
        { timeout: 30000 }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip any accidental markdown fences before parsing
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    try {
        const parsed = JSON.parse(cleaned);
        return {
            summary: parsed.summary || 'Summary not available.',
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
            deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
            nextHearingPurpose: parsed.nextHearingPurpose || '',
        };
    } catch (_) {
        // If Gemini returns malformed JSON, return raw text as summary
        console.warn('   ⚠️  Gemini returned non-JSON, using raw text as summary');
        return { summary: rawText.substring(0, 500), actions: [], deadlines: [], nextHearingPurpose: '' };
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Internal: persist text + summary to Firestore (Phase P-2 / P-3 storage)
// ════════════════════════════════════════════════════════════════════════════
async function persistToFirestore(cnr, hearingId, data) {
    try {
        const admin = require('firebase-admin');
        const db = admin.firestore();
        await db
            .collection('cases')
            .doc(cnr.toUpperCase())
            .collection('orders')
            .doc(String(hearingId))
            .set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
        console.log(`   💾 Firestore: saved order data for ${cnr}/${hearingId}`);
    } catch (err) {
        console.warn(`   ⚠️  Firestore persist failed: ${err.message}`);
    }
}

module.exports = router;
