/**
 * Shared hearing helpers. `hearings` are ALWAYS oldest-first (see parser.js / demo-cases.js).
 */
const { isAdjourned } = require('./ecourts/classifier');

/** The most recent hearing that has already happened (date <= today), else the newest one. */
function lastHearing(hearings, todayISO) {
    if (!hearings || !hearings.length) return null;
    if (todayISO) {
        for (let i = hearings.length - 1; i >= 0; i--) {
            if (hearings[i].date && hearings[i].date <= todayISO) return hearings[i];
        }
    }
    return hearings[hearings.length - 1];
}

/**
 * Consistent counts used everywhere:
 *   heard      — productive
 *   adjourned  — confirmed adjournments (court / lawyer / other)
 *   unclear    — classification unknown
 *   disposed   — final outcome rows
 * "unproductive" = adjourned + unclear (the comparison with DAKSH's national figure uses this);
 * "adjournmentRate" counts confirmed adjournments only.
 */
function hearingStats(hearings = []) {
    let heard = 0, adjourned = 0, unclear = 0, disposed = 0;
    let court = 0, lawyer = 0, other = 0;
    for (const h of hearings) {
        const c = h.classification;
        if (c === 'productive') heard++;
        else if (isAdjourned(c)) {
            adjourned++;
            if (c === 'adjourned_court') court++;
            else if (c === 'adjourned_lawyer') lawyer++;
            else other++;
        } else if (c === 'disposed') disposed++;
        else unclear++;
    }
    const total = hearings.length;
    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const unproductive = adjourned + unclear;
    return {
        total, heard, adjourned, unclear, disposed, unproductive,
        adjournedByCourt: court, adjournedByLawyer: lawyer, adjournedOther: other,
        adjournmentRate: pct(adjourned, total),
        unproductiveRate: pct(unproductive, total),
    };
}

module.exports = { lastHearing, hearingStats };
