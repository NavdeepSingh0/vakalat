/**
 * Hearing classification + case-stage detection.
 *
 * eCourts only gives a short "purpose" string per hearing, so classification is a heuristic.
 * The rule is: if the text does not clearly say what happened, the result is `unknown` —
 * we never guess "productive" or "adjourned".
 *
 * classification:
 *   productive        the case moved forward (evidence, arguments, pleadings, ...)
 *   adjourned_court   postponed for a reason on the court's side (heavy board, judge on leave, ...)
 *   adjourned_lawyer  postponed because an advocate was absent / sought time
 *   adjourned_other   postponed, cause not attributable from the text
 *   disposed          final outcome (dismissed, decreed, withdrawn, settled, ...) — not an adjournment
 *   unknown           not enough information
 *
 * faultParty (only meaningful for adjournments; the user is assumed to be the petitioner/plaintiff):
 *   own_side | opposite_party | court_system | unspecified
 */

const OPPOSITE_RE = /\b(respondent|defendant|opposite\s+part(?:y|ies)|accused|other\s+side|state\s+counsel)\b/i;
const OWN_RE = /\b(petitioner|plai?ntiff|complainant|appellant|applicant)\b/i;

function partyFromText(text) {
    const opposite = OPPOSITE_RE.test(text);
    const own = OWN_RE.test(text);
    if (opposite && !own) return 'opposite_party';
    if (own && !opposite) return 'own_side';
    return 'unspecified';
}

// Order matters: first match wins.
const RULES = [
    {
        // Court-side reasons
        re: /\b(nnfr|not\s+(?:taken\s+up|heard|reached)|heavy\s+board|board\s+too\s+heavy|court\s+busy|judge\s+(?:on\s+leave|transferred)|presiding\s+officer\s+(?:on\s+leave|transferred)|court\s+holiday|vacation|strike|covid|lockdown|sine\s+die)\b/i,
        classification: 'adjourned_court',
        fault: () => 'court_system',
    },
    {
        // An advocate / counsel / APP was absent or asked for time
        re: /\b(?:advocate|counsel|lawyer|app|a\.p\.p)\b.{0,40}\b(?:absent|not\s+present|sought|seeks?|requested?|requests?|time)\b|\b(?:absent|time\s+sought)\b.{0,40}\b(?:advocate|counsel|lawyer)\b/i,
        classification: 'adjourned_lawyer',
        fault: partyFromText,
    },
    {
        // Final outcomes — checked before generic "adjourned" so "dismissed" isn't lost
        re: /\b(disposed|decreed|dismissed|withdrawn|settled|acquitted|convicted|compromised|decided)\b/i,
        classification: 'disposed',
        fault: () => 'unspecified',
        unless: /\badjourn/i,
    },
    {
        // Generic postponement
        re: /^\s*(?:adj|adjourned)\s*$|\badjourn|\bs\/o\b|\bstanding\s+over\b|\bpostpone/i,
        classification: 'adjourned_other',
        fault: partyFromText,
    },
    {
        // Clear forward progress
        re: /\b(heard|part\s*heard|plai?ntiff'?s?\s+evidence|defen[cd]e?(?:ndant)?'?s?\s+evidence|prosecution\s+evidence|evidence|cross[-\s]*exam\w*|chief\s+exam\w*|arguments?|judg(?:e)?ment|written\s+statement|framing\s+(?:of\s+)?issues?|issues?\s+framed|exhibit\w*|admission|cognizance|charges?\s+framed|framing\s+of\s+charge|notice|summons)\b/i,
        classification: 'productive',
        fault: () => 'unspecified',
    },
];

/**
 * @param {string} text purpose / business text from eCourts
 * @returns {{classification: string, faultParty: string}}
 */
function classifyHearing(text) {
    const t = String(text || '').trim();
    if (!t) return { classification: 'unknown', faultParty: 'unspecified' };
    for (const rule of RULES) {
        if (rule.re.test(t) && !(rule.unless && rule.unless.test(t))) {
            return { classification: rule.classification, faultParty: rule.fault(t) };
        }
    }
    return { classification: 'unknown', faultParty: 'unspecified' };
}

function isAdjourned(classification) {
    return typeof classification === 'string' && classification.startsWith('adjourned');
}

// ── Stage detection (1–8, matches ecourts-codes.json "stages") ───────────────────────────────────
// Highest stage first; word-bounded so "allowed" / "decree" inside other words never trigger Stage 8.
const STAGE_PATTERNS = [
    { stage: 8, code: 'JUD', re: /\b(judg(?:e)?ment|disposed|disposal|decreed|pronouncement|for\s+orders)\b|\bjud\b/i },
    { stage: 7, code: 'ARG', re: /\b(?:final\s+)?arguments?\b|\barg\b/i },
    { stage: 6, code: 'DE', re: /\b(?:defen[cd]e?(?:ndant)?'?s?\s+evidence|dw)\b|\bde\b/i },
    { stage: 5, code: 'PE', re: /\b(?:plai?ntiff'?s?\s+evidence|prosecution\s+evidence|evidence|cross[-\s]*exam\w*|chief\s+exam\w*)\b|\bpe\b/i },
    { stage: 4, code: 'FRA', re: /\b(?:framing\s+(?:of\s+)?(?:issues?|charges?)|issues?(?:\s+framed)?|charges?\s+framed)\b|\bfra\b/i },
    { stage: 3, code: 'WS', re: /\b(?:written\s+statement|replica|replication|notice|summons?|service)\b|\bws\b/i },
    { stage: 2, code: 'ADM', re: /\b(?:admission|appearance|cognizance)\b|\badm\b/i },
    { stage: 1, code: 'FIL', re: /\b(?:filing|registered|registration)\b|\bfil\b/i },
];

/** @returns {{stage:number, code:string}|null} */
function stageFromText(text) {
    const t = String(text || '');
    if (!t.trim()) return null;
    for (const p of STAGE_PATTERNS) {
        if (p.re.test(t)) return { stage: p.stage, code: p.code };
    }
    return null;
}

/**
 * Adds a numeric `stage` to each hearing (oldest-first input). The stage only moves forward and
 * is capped at the case's current stage, so old adjournments are not charged at today's stage.
 */
function assignHearingStages(hearings, currentStage = 8) {
    const cap = Math.min(Math.max(Number(currentStage) || 8, 1), 8);
    let running = 1;
    for (const h of hearings) {
        const found = stageFromText(h.purpose || h.business || '');
        if (found) running = Math.max(running, found.stage);
        h.stage = Math.min(running, cap);
    }
    return hearings;
}

module.exports = {
    classifyHearing, isAdjourned, partyFromText,
    stageFromText, assignHearingStages, STAGE_PATTERNS,
};
