import { useEffect } from 'react';

// ─── Date formatter ──────────────────────────────────────────────────────────
export const fmt = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Scroll reveal hook ──────────────────────────────────────────────────────
export const useReveal = () => {
    useEffect(() => {
        const els = document.querySelectorAll("[data-reveal],[data-line-wipe]");
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("vis"); });
        }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
        els.forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, []);
};

// ─── Stage definitions (matches backend ecourts-codes.json) ──────────────────
export const STAGES = [
    { id: 1, label: "Filing & Registration", plainEnglish: "The case has been filed and is waiting for the court to officially register and assign it.", avgMonths: 1 },
    { id: 2, label: "Admission", plainEnglish: "The court is deciding whether to officially accept and hear this case.", avgMonths: 2 },
    { id: 3, label: "Notice & Written Statement", plainEnglish: "The court is issuing legal notices to the other party, asking them to appear and respond.", avgMonths: 6 },
    { id: 4, label: "Framing of Issues", plainEnglish: "The judge is formally defining the legal questions that both parties must argue and prove.", avgMonths: 3 },
    { id: 5, label: "Plaintiff's Evidence", plainEnglish: "Your side is presenting documents, witnesses, and proof to support your claims in court.", avgMonths: 12 },
    { id: 6, label: "Defendant's Evidence", plainEnglish: "The opposing party is now presenting their evidence and witnesses before the court.", avgMonths: 10 },
    { id: 7, label: "Final Arguments", plainEnglish: "Both lawyers are making their closing arguments. The judge is preparing to decide.", avgMonths: 6 },
    { id: 8, label: "Judgment", plainEnglish: "The judge has heard all arguments and is writing the final decision in the case.", avgMonths: 3 },
];

// ─── Parse Indian date formats ───────────────────────────────────────────────
function parseIndianDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === '—') return '';
    const s = dateStr.trim();

    // Already ISO (YYYY-MM-DD)?
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;

    // DD-MM-YYYY or DD/MM/YYYY
    const m = s.match(/(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})/);
    if (m) {
        const [, dd, mm, yyyy] = m;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    // Ordinal dates: "22nd August 2016", "31st July 2026", "1st January 2020"
    const fullMonths = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
    const ordM = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (ordM && fullMonths[ordM[2].toLowerCase()]) {
        return `${ordM[3]}-${fullMonths[ordM[2].toLowerCase()]}-${ordM[1].padStart(2, '0')}`;
    }

    // DD-Mon-YYYY (e.g., "14-Apr-2025")
    const shortMonths = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const m2 = s.match(/(\d{1,2})[\-\/\s](\w{3})[\-\/\s](\d{4})/i);
    if (m2) {
        const mm = shortMonths[m2[2].toLowerCase().substring(0, 3)];
        if (mm) return `${m2[3]}-${mm}-${m2[1].padStart(2, '0')}`;
    }

    // Last resort
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

    return '';
}

// ─── Purpose code → plain English ────────────────────────────────────────────
const PURPOSE_TRANSLATIONS = {
    'appearance': 'Initial appearance — parties present themselves before the court.',
    'further order': 'Case adjourned to await further orders from the court.',
    'consideration': 'The matter is under judicial consideration.',
    'plantiff evidence': 'Plaintiff presenting evidence — witnesses and documents.',
    'plaintiff evidence': 'Plaintiff presenting evidence — witnesses and documents.',
    'defendant evidence': 'Defendant presenting evidence — witnesses and documents.',
    'written statement': 'Written Statement filed by the responding party.',
    'replica': 'Reply to the Written Statement filed.',
    'lok adalat': 'Case referred to Lok Adalat for settlement.',
    'argument': 'Final arguments being heard by the court.',
    'judgment': 'Judgment being delivered or reserved.',
    'service': 'Court notices being served to parties.',
    'mediation': 'Case referred for mediation / alternative dispute resolution.',
    'nnfr': 'Case was called but not heard today — court board was full.',
    'reply': 'Reply/response filed by a party.',
    'settlement': 'Parties exploring settlement of the dispute.',
};

function translatePurpose(purpose) {
    if (!purpose) return '—';
    const key = purpose.trim().toLowerCase();
    return PURPOSE_TRANSLATIONS[key] || purpose;
}

// Check if a string looks like a date (not a description)
function looksLikeDate(str) {
    if (!str) return true;
    const s = str.trim();
    if (/^\d{1,2}[\-\/]\d{1,2}[\-\/]\d{4}$/.test(s)) return true;
    if (/^\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}$/i.test(s)) return true;
    return false;
}

// ─── Normalize backend case data to the shape UI components expect ───────────
export function normalizeCaseData(raw) {
    const d = raw.data || raw;

    const rawHearings = d.hearings || [];
    const hearings = rawHearings.map((h, i, arr) => {
        // businessOnDate = usually a DATE link in live data, NOT a description
        // purpose = the actual hearing purpose code (e.g., "Further Order", "Plaintiff Evidence")
        // businessTranslated = backend-translated version of purpose (if match found in ecourts-codes.json)

        let description;
        if (h.businessTranslated && h.businessTranslated !== h.purpose) {
            description = h.businessTranslated;
        } else if (!looksLikeDate(h.businessOnDate)) {
            description = h.businessOnDate;
        } else {
            description = translatePurpose(h.purpose || h.business);
        }

        return {
            date: parseIndianDate(h.date),
            businessPlainEnglish: description || '—',
            hearingDate: i > 0 ? parseIndianDate(arr[i - 1].date) : parseIndianDate(d.nextHearingDate) || '—',
            isAdjournment: h.classification
                ? (h.classification === 'unknown' ? null : h.classification !== 'productive')
                : (/^adj$|further.*order|^fo$|adjourned|nnfr|s\/o|standing.*over|postpone/i.test(h.purpose || h.business || '') ? true
                    : /appearance|heard|evidence|argument|judgment|notice|written.*statement|framing|exhibit|admission|cognizance|charge/i.test(h.purpose || h.business || '') ? false
                        : null),
            classification: h.classification || 'adjourned_other',
            purpose: h.purpose || h.business || h.businessTranslated || '—',
            judge: h.judge || '—',
            orderPdfUrl: h.orderPdfUrl || null,
        };
    });

    hearings.reverse();

    const stageId = d.currentStage || 1;

    return {
        caseDetails: {
            cnr: d.cnr || '',
            courtName: d.court || '',
            courtNumberJudge: d.courtNumberJudge || '',
            caseType: d.caseType || '',
            filingDate: parseIndianDate(d.filedDate || d['Filing Date']),
            registrationDate: parseIndianDate(d.registrationDate),
            firstHearingDate: parseIndianDate(d.firstHearingDate),
            nextHearingDate: parseIndianDate(d.nextHearingDate),
            caseStage: d.caseStageExplicit || d.stageName || '',
            stageId,
            petitionerAdvocate: d.petitioner || '',
            respondentAdvocate: d.respondent || '',
            petitionerLawyer: d.petitionerAdvocate || '',
            respondentLawyer: d.respondentAdvocate || '',
        },
        hearings,
        source: d.source || raw.source || 'unknown',
    };
}
