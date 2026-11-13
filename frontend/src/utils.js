import { useEffect } from 'react';

// A CNR is 4 letters (state + district) followed by 12 digits (establishment, case number, year).
export const CNR_RE = /^[A-Z]{4}\d{12}$/;

// ─── Dates ───────────────────────────────────────────────────────────────────
// The API returns ISO dates (YYYY-MM-DD). They are formatted in UTC so a date never shifts by a day
// depending on the viewer's timezone.
export const fmt = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const FULL_MONTHS = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
const SHORT_MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** Defensive parser for date strings from older/cached payloads. Returns ISO (YYYY-MM-DD) or ''. */
export function parseIndianDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === '—') return '';
    const s = String(dateStr).trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    const numeric = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;

    const ordinal = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (ordinal && FULL_MONTHS[ordinal[2].toLowerCase()]) {
        return `${ordinal[3]}-${FULL_MONTHS[ordinal[2].toLowerCase()]}-${ordinal[1].padStart(2, '0')}`;
    }

    const short = s.match(/(\d{1,2})[-/\s](\w{3})[-/\s](\d{4})/i);
    if (short) {
        const mm = SHORT_MONTHS[short[2].toLowerCase()];
        if (mm) return `${short[3]}-${mm}-${short[1].padStart(2, '0')}`;
    }
    return '';
}

/** Whole months between two ISO dates (floor), never negative. */
export function monthsBetween(fromISO, toISO) {
    const a = Date.parse(`${fromISO}T00:00:00Z`);
    const b = Date.parse(`${toISO}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    return Math.max(0, Math.floor((b - a) / (30.44 * 86400000)));
}

export const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

/** "2 years, 3 months" / "7 months" */
export function formatAge(months) {
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts = [];
    if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`);
    if (m || !y) parts.push(`${m} month${m === 1 ? '' : 's'}`);
    return parts.join(', ');
}

// ─── Scroll reveal ───────────────────────────────────────────────────────────
// Pass a dependency (e.g. "data loaded") when the revealed elements mount after the first render.
export const useReveal = (ready = true) => {
    useEffect(() => {
        if (!ready) return undefined;
        const els = document.querySelectorAll('[data-reveal],[data-line-wipe],.line-wipe');
        if (typeof IntersectionObserver === 'undefined') {
            els.forEach((el) => el.classList.add('vis'));
            return undefined;
        }
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); } });
        }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, [ready]);
};

// ─── Purpose text → plain English (fallback when the backend has no exact code match) ──
const PURPOSE_TRANSLATIONS = {
    'appearance': 'Parties present themselves before the court.',
    'further order': 'The court will pass further orders on the next date.',
    'consideration': 'The matter is under judicial consideration.',
    'plantiff evidence': 'Plaintiff presenting evidence — witnesses and documents.',
    'plaintiff evidence': 'Plaintiff presenting evidence — witnesses and documents.',
    'defendant evidence': 'Defendant presenting evidence — witnesses and documents.',
    'written statement': 'Written statement (the reply to the case) is due or has been filed.',
    'replica': 'Reply to the written statement.',
    'lok adalat': 'Case referred to Lok Adalat for settlement.',
    'argument': 'Final arguments being heard by the court.',
    'arguments': 'Final arguments being heard by the court.',
    'judgment': 'Judgment being delivered or reserved.',
    'service': 'Court notices are being served on the parties.',
    'mediation': 'Case referred for mediation.',
    'nnfr': 'Case was called but not heard today — the court board was full.',
    'reply': 'Reply/response filed by a party.',
    'settlement': 'Parties exploring settlement of the dispute.',
};

export function translatePurpose(purpose) {
    if (!purpose) return '—';
    return PURPOSE_TRANSLATIONS[purpose.trim().toLowerCase()] || purpose;
}

// ─── Hearing status ──────────────────────────────────────────────────────────
// adjourned | heard | disposed | unclear — mirrors the backend classification.
export function hearingStatus(classification) {
    if (typeof classification === 'string' && classification.startsWith('adjourned')) return 'adjourned';
    if (classification === 'productive') return 'heard';
    if (classification === 'disposed') return 'disposed';
    return 'unclear';
}

export const STATUS_LABEL = { adjourned: 'ADJOURNED', heard: 'HEARD', disposed: 'OUTCOME', unclear: 'UNCLEAR' };

// ─── Normalise the API's case payload for the UI ─────────────────────────────
// Input is the public case from GET /api/case/:cnr (hearings oldest-first, ISO dates).
// Output hearings are newest-first (sorted by date), which is what the tables show.
export function normalizeCaseData(raw) {
    const d = (raw && raw.data) || raw || {};

    const hearings = (d.hearings || []).map((h, i) => {
        const purpose = h.purpose || h.business || '';
        const description = h.businessTranslated && h.businessTranslated !== purpose
            ? h.businessTranslated
            : translatePurpose(purpose);
        return {
            id: h.id ?? i + 1,
            date: parseIndianDate(h.date),
            description: description || '—',
            status: hearingStatus(h.classification),
            classification: h.classification || 'unknown',
            purpose: purpose || '—',
            judge: h.judge || '—',
            hasOrder: Boolean(h.hasOrder),
            stage: h.stage || null,
        };
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    return {
        caseDetails: {
            cnr: d.cnr || '',
            title: d.title || '',
            courtName: d.court || '',
            courtType: d.courtType || 'district',
            state: d.state || '',
            district: d.district || '',
            caseType: d.caseType || '',
            caseStatus: d.caseStatus || '',
            isDisposed: Boolean(d.isDisposed),
            filingDate: parseIndianDate(d.filedDate),
            registrationDate: parseIndianDate(d.registrationDate),
            firstHearingDate: parseIndianDate(d.firstHearingDate),
            nextHearingDate: parseIndianDate(d.nextHearingDate),
            nextHearingPurpose: d.nextHearingPurpose || '',
            caseStage: d.caseStageExplicit || '',
            stageId: d.currentStage || 1,
            petitioner: d.petitioner || '',
            respondent: d.respondent || '',
            petitionerAdvocate: d.petitionerAdvocate || '',
            respondentAdvocate: d.respondentAdvocate || '',
        },
        hearings,
        stats: d.hearingStats || null,
        isDemo: Boolean(d.isDemo),
        source: d.source || 'unknown',
    };
}

// ─── Reference timeline ("speedy trial" banner) ──────────────────────────────
// Our own reference points — not an official limit: civil 3 years, criminal 1 year.
export const CRIMINAL_CASE_RE = /crim|\bcrl\b|cr\.?\s?m\.?p|\bcc\b|\bsessions\b|\bbail\b|\bndps\b|\bpocso\b|\bfir\b|complaint case|cheating|\bipc\b|\bbns\b/i;

export function isCriminalCaseType(caseType) {
    return CRIMINAL_CASE_RE.test(caseType || '');
}

/** @returns {null | {ageMonths:number, benchmarkMonths:number, excessMonths:number, isCivil:boolean}} */
export function speedyTrial(caseDetails, now = new Date()) {
    if (!caseDetails || caseDetails.isDisposed || !caseDetails.filingDate) return null;
    const ageMonths = monthsBetween(caseDetails.filingDate, todayISO(now));
    const isCivil = !isCriminalCaseType(caseDetails.caseType);
    const benchmarkMonths = isCivil ? 36 : 12;
    if (ageMonths <= benchmarkMonths) return null;
    return { ageMonths, benchmarkMonths, excessMonths: ageMonths - benchmarkMonths, isCivil };
}

/** Sets the browser tab title for a page. */
export function useDocumentTitle(title) {
    useEffect(() => {
        const previous = document.title;
        document.title = title ? `${title} — Vakalat` : 'Vakalat — Your court case, in plain English';
        return () => { document.title = previous; };
    }, [title]);
}
