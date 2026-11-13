/**
 * ADJOURNMENT COST MODEL v3.3 — single source of truth (the frontend calls POST /api/case/:cnr/cost).
 *
 * Estimates what each confirmed adjournment cost a litigant. It is an ESTIMATE built from assumed
 * fee / wage tables; every input can be overridden by the user.
 *
 *   weightedCost = baseCost × stageMultiplier × faultMultiplier
 *   baseCost     = professional fees + travel/stay + opportunity cost + incidentals
 *
 * Changes from v3.2: clerk fee is no longer counted twice; the user's fee is the total retained
 * counsel fee (extra juniors are opt-in); outstation/intercity travel includes the hotel (as labelled);
 * adjournments whose cause is not recorded are weighted neutrally instead of being guessed.
 *
 * Legal references (context, not legal advice):
 *   Order XVII Rules 1–2 CPC · Sections 35, 35A, 35B CPC · Ramrameshwari Devi v. Nirmala Devi (2011) 8 SCC 249
 * Data sources (assumptions — verify before relying on them):
 *   DHCLSC fee schedule (1 July 2024) · PLFS 2023-24 (MoSPI/NSO) · MGNREGA wage schedule 2024-25 ·
 *   Law Ministry panel counsel rates · Law Commission Report No. 240
 * Applies to district and high court matters alike; fee defaults reflect metro high-court practice.
 */

// Multipliers: later stages cost more because the whole record must be re-read.
const STAGE_MULTIPLIERS = {
    filing_admission: 0.60,
    notice_service: 0.75,
    interlocutory: 0.90,
    evidence: 1.00, // baseline
    final_arguments: 1.50,
    order_reserved: 1.80,
};

// Numeric case stage (1–8, from the classifier) → multiplier key.
const STAGE_KEY_BY_NUMBER = {
    1: 'filing_admission', 2: 'filing_admission', 3: 'notice_service', 4: 'interlocutory',
    5: 'evidence', 6: 'evidence', 7: 'final_arguments', 8: 'order_reserved',
};

const FAULT_CONFIG = {
    court_system: { multiplier: 1.00, recoverable: false, basis: 'S.35 CPC — discretionary' },
    opposite_party: { multiplier: 1.20, recoverable: true, basis: 'Order XVII Rule 2 — costs may be recoverable' },
    own_side: { multiplier: 0.50, recoverable: false, basis: 'Absorbed — own side caused it' },
    mutual_consent: { multiplier: 0.75, recoverable: false, basis: 'S.35B CPC — shared delay' },
    unspecified: { multiplier: 1.00, recoverable: false, basis: 'Cause not recorded — neutral weighting' },
};

const OPPORTUNITY_COST_RATES = {
    unskilled_casual: 550,
    skilled_informal: 1100,
    salaried_formal: 1800,
    self_employed_small: 4500,
    professional: 7500,
    corporate_officer: 20000, // declared input, not PLFS
    senior_executive: 50000, // declared input, not PLFS
};

const WORKER_LABELS = {
    unskilled_casual: 'Casual labour / unskilled',
    skilled_informal: 'Skilled informal',
    salaried_formal: 'Salaried formal',
    self_employed_small: 'Self-employed (small)',
    professional: 'Professional / managerial',
    corporate_officer: 'Corporate officer',
    senior_executive: 'Senior executive',
};

const TRAVEL_COSTS = {
    local: { travel: 500, hotel: 0, label: 'Local (auto/cab within the city)' },
    outstation: { travel: 2000, hotel: 3000, label: 'Outstation (train + hotel)' },
    intercity: { travel: 6000, hotel: 5000, label: 'Intercity (flight + hotel)' },
};

const INCIDENTALS = {
    agentClerkFee: 1500, // per hearing, when a clerk/agent attends
    photocopyMisc: 400,
    affidavitCost: 800, affidavitProbability: 0.30,
    notaryCost: 500, notaryProbability: 0.25,
    docRePrepFraction: 0.10, // share of original document prep re-spent per adjournment
};

const JUNIOR_FEE_CAP = 15000;
const JUNIOR_FEE_RATIO = 0.67;
const DEFAULT_SENIOR_FEE = 32500;

function professionalFees(seniorFee = DEFAULT_SENIOR_FEE, juniorCount = 0, juniorFeeFixed = null) {
    if (seniorFee === 0) return (juniorFeeFixed || 10000) * Math.max(juniorCount, 1); // junior-only matter
    const perJunior = Math.min(seniorFee * JUNIOR_FEE_RATIO, JUNIOR_FEE_CAP);
    return seniorFee + perJunior * juniorCount;
}

function travelCost(mode = 'local', includeHotel = mode !== 'local') {
    const t = TRAVEL_COSTS[mode] || TRAVEL_COSTS.local;
    return t.travel + (includeHotel ? t.hotel : 0);
}

function opportunityCost(workerType = 'salaried_formal', customDailyRate = null) {
    if (customDailyRate > 0) return customDailyRate;
    return OPPORTUNITY_COST_RATES[workerType] || OPPORTUNITY_COST_RATES.salaried_formal;
}

function incidentalCosts(originalDocPrepCost = 15000, hasClerk = true, overrides = {}) {
    const c = { ...INCIDENTALS, ...overrides };
    return (hasClerk ? c.agentClerkFee : 0) + c.photocopyMisc
        + c.affidavitCost * c.affidavitProbability
        + c.notaryCost * c.notaryProbability
        + originalDocPrepCost * c.docRePrepFraction;
}

const DEFAULT_CONFIG = {
    seniorFeePerHearing: DEFAULT_SENIOR_FEE,
    juniorCount: 0,
    hasClerk: true,
    juniorFeeFixed: null,
    travelMode: 'local',
    includeHotel: null, // null → derived from travelMode
    workerType: 'salaried_formal',
    customDailyRate: null,
    originalDocPrepCost: 15000,
    incidentalOverrides: {},
};

/** Maps a hearing from the case store to the model's input. */
function toModelHearing(h) {
    const adjourned = typeof h.classification === 'string' && h.classification.startsWith('adjourned');
    const stageKey = STAGE_KEY_BY_NUMBER[h.stage] || 'evidence';
    let fault = h.faultParty;
    if (!FAULT_CONFIG[fault]) {
        // Older data without faultParty: derive from the classification only.
        fault = h.classification === 'adjourned_court' ? 'court_system' : 'unspecified';
    }
    return { date: h.date, stage: stageKey, fault, adjourned, reason: h.businessTranslated || h.purpose || '' };
}

/**
 * @param {Array<{date,stage,fault,adjourned,reason}>} hearings model-shaped hearings
 * @param {object} costConfig overrides for DEFAULT_CONFIG
 */
function calculateAdjournmentImpact(hearings, costConfig = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...costConfig };
    const includeHotel = cfg.includeHotel === null || cfg.includeHotel === undefined ? cfg.travelMode !== 'local' : cfg.includeHotel;

    const base = {
        professionalFees: professionalFees(cfg.seniorFeePerHearing, cfg.juniorCount, cfg.juniorFeeFixed),
        travelStay: travelCost(cfg.travelMode, includeHotel),
        opportunityCost: opportunityCost(cfg.workerType, cfg.customDailyRate),
        incidentals: incidentalCosts(cfg.originalDocPrepCost, cfg.hasClerk, cfg.incidentalOverrides),
    };
    const baseCost = base.professionalFees + base.travelStay + base.opportunityCost + base.incidentals;

    const totals = { totalDrain: 0, recoverableFromOP: 0, absorbedByOwn: 0, systemicCost: 0, mutualConsentCost: 0, unattributedCost: 0 };
    const costHeadSummary = { professionalFees: 0, travelStay: 0, opportunityCost: 0, incidentals: 0 };

    const perHearingBreakdown = hearings.filter((h) => h.adjourned).map((h, i) => {
        const stageMult = STAGE_MULTIPLIERS[h.stage] ?? 1.0;
        const faultCfg = FAULT_CONFIG[h.fault] ?? FAULT_CONFIG.unspecified;
        const m = stageMult * faultCfg.multiplier;
        const weightedCost = baseCost * m;

        for (const k of Object.keys(costHeadSummary)) costHeadSummary[k] += base[k] * m;
        totals.totalDrain += weightedCost;
        if (h.fault === 'opposite_party') totals.recoverableFromOP += weightedCost;
        else if (h.fault === 'own_side') totals.absorbedByOwn += weightedCost;
        else if (h.fault === 'court_system') totals.systemicCost += weightedCost;
        else if (h.fault === 'mutual_consent') totals.mutualConsentCost += weightedCost;
        else totals.unattributedCost += weightedCost;

        return {
            index: i + 1, date: h.date, stage: h.stage, fault: h.fault, reason: h.reason,
            baseCost: Math.round(baseCost), stageMult, faultMult: faultCfg.multiplier,
            weightedCost: Math.round(weightedCost), recoverable: faultCfg.recoverable, basis: faultCfg.basis,
        };
    });

    const adjournedCount = perHearingBreakdown.length;
    const r = (n) => Math.round(n);
    return {
        totalDrain: r(totals.totalDrain),
        recoverableFromOP: r(totals.recoverableFromOP),
        absorbedByOwn: r(totals.absorbedByOwn),
        systemicCost: r(totals.systemicCost),
        mutualConsentCost: r(totals.mutualConsentCost),
        unattributedCost: r(totals.unattributedCost),
        netUnrecoverable: r(totals.totalDrain - totals.recoverableFromOP),
        adjournedCount,
        avgCostPerAdj: adjournedCount ? r(totals.totalDrain / adjournedCount) : 0,
        baseCostPerHearing: r(baseCost),
        costHeadSummary: Object.fromEntries(Object.entries(costHeadSummary).map(([k, v]) => [k, r(v)])),
        perHearingBreakdown,
    };
}

/** Convenience: run the model over a stored case's hearings. */
function estimateCaseCost(caseData, costConfig = {}) {
    const hearings = (caseData.hearings || []).map(toModelHearing);
    const impact = calculateAdjournmentImpact(hearings, costConfig);
    const unclearCount = (caseData.hearings || []).filter((h) => h.classification === 'unknown').length;
    return { ...impact, unclearCount };
}

/** What the UI needs to render its inputs (labels + rates), so no table is duplicated client-side. */
function getCostConfigOptions() {
    return {
        defaults: { seniorFeePerHearing: DEFAULT_SENIOR_FEE, juniorCount: 0, travelMode: 'local', workerType: 'salaried_formal' },
        workerTypes: Object.keys(OPPORTUNITY_COST_RATES).map((id) => ({ id, label: WORKER_LABELS[id], perDay: OPPORTUNITY_COST_RATES[id] })),
        travelModes: Object.keys(TRAVEL_COSTS).map((id) => ({ id, label: TRAVEL_COSTS[id].label, travel: TRAVEL_COSTS[id].travel, hotel: TRAVEL_COSTS[id].hotel })),
        stageMultipliers: STAGE_MULTIPLIERS,
        faultMultipliers: Object.fromEntries(Object.entries(FAULT_CONFIG).map(([k, v]) => [k, v.multiplier])),
        limits: { seniorFeePerHearing: { min: 0, max: 1000000 }, juniorCount: { min: 0, max: 5 }, customDailyRate: { min: 0, max: 1000000 } },
        disclaimer: 'Estimate only. Built from assumed fee and wage tables — replace them with your actual figures.',
    };
}

module.exports = {
    STAGE_MULTIPLIERS, STAGE_KEY_BY_NUMBER, FAULT_CONFIG, OPPORTUNITY_COST_RATES, TRAVEL_COSTS, INCIDENTALS,
    JUNIOR_FEE_CAP, JUNIOR_FEE_RATIO, DEFAULT_SENIOR_FEE, DEFAULT_CONFIG,
    professionalFees, travelCost, opportunityCost, incidentalCosts,
    toModelHearing, calculateAdjournmentImpact, estimateCaseCost, getCostConfigOptions,
};
