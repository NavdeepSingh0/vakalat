/**
 * Court-order PDFs: download, text extraction, AI summary.
 *
 * The client only ever sends (cnr, hearingId). Which PDF to fetch, and from which host, is decided
 * here from data this server stored itself — there is no client-supplied URL (this closes the
 * former SSRF hole).
 */
const { HttpError } = require('../middleware/errorHandler');
const { DEMO_ORDERS } = require('../data/demo-orders');
const { textToPdf } = require('./simplePdf');
const logger = require('./logger');

async function extractPdfText(buffer) {
    const { PDFParse } = require('pdf-parse'); // pdf-parse v2 exposes a class
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
        const result = await parser.getText();
        return String(result.text || '').trim();
    } finally {
        await parser.destroy().catch(() => { });
    }
}

function createOrderService({ store, ecourts, gemini }) {
    async function locate(cnr, hearingId) {
        const caseData = await store.getCase(cnr);
        if (!caseData) throw new HttpError(404, 'case_not_found', 'Case not found. It may have expired — please search for it again.');
        const hearing = (caseData.hearings || []).find((h) => h.id === hearingId);
        if (!hearing) throw new HttpError(404, 'hearing_not_found', 'Hearing not found.');
        if (!hearing.orderRef) throw new HttpError(404, 'pdf_not_found', 'No order has been uploaded to eCourts for this hearing.');
        return { caseData, hearing };
    }

    const demoKey = (cnr, id) => `${cnr}:${id}`;

    async function getPdf(cnr, hearingId) {
        const { hearing } = await locate(cnr, hearingId);
        if (hearing.orderRef.demo) {
            const demo = DEMO_ORDERS[demoKey(cnr, hearingId)];
            if (!demo) throw new HttpError(404, 'pdf_not_found', 'Sample order not available.');
            return textToPdf(demo.text);
        }
        return ecourts.fetchOrderPdf(cnr, hearing.orderRef);
    }

    async function getText(cnr, hearingId) {
        const cached = await store.getOrder(cnr, hearingId);
        if (cached && cached.text) return { text: cached.text, cached: true };

        const { hearing } = await locate(cnr, hearingId);
        let text;
        if (hearing.orderRef.demo) {
            const demo = DEMO_ORDERS[demoKey(cnr, hearingId)];
            text = demo ? demo.text : '';
        } else {
            const pdf = await ecourts.fetchOrderPdf(cnr, hearing.orderRef);
            try { text = await extractPdfText(pdf); }
            catch (err) {
                logger.warn({ err: err.message }, 'pdf text extraction failed');
                throw new HttpError(422, 'unreadable_pdf', 'This order could not be read.');
            }
        }
        await store.patchOrder(cnr, hearingId, { text });
        return { text, cached: false };
    }

    async function getSummary(cnr, hearingId) {
        const cached = await store.getOrder(cnr, hearingId);
        if (cached && cached.summary) return { ...cached.summary, cached: true };

        const { hearing } = await locate(cnr, hearingId);
        const { text } = await getText(cnr, hearingId);
        if (!text || text.trim().length < 20) {
            throw new HttpError(422, 'no_text', 'No readable text in this PDF — it may be a scanned image.');
        }

        let summary;
        if (hearing.orderRef.demo) {
            // Demo orders are fictional: always serve the pre-written sample summary (deterministic, offline).
            summary = { ...DEMO_ORDERS[demoKey(cnr, hearingId)].summary, generatedAt: new Date().toISOString() };
        } else {
            summary = await gemini.summarise(text);
        }
        await store.patchOrder(cnr, hearingId, { summary });
        return { ...summary, cached: false };
    }

    return { getPdf, getText, getSummary, locate };
}

module.exports = { createOrderService, extractPdfText };
