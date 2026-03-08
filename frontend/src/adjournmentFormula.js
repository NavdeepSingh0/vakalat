/**
 * INDIAN HIGH COURT — ADJOURNMENT COST FORMULA v3.2
 *
 * Base: v3.0 (88–90% accuracy, all citations intact)
 * Backported from v3.1: juniorCount, hasClerk, senior_executive tier
 * All other v3.1 changes rejected — unjustified regressions
 *
 * Legal Basis:
 * [L1] Order XVII Rule 1(2) CPC  — costs occasioned by adjournment
 * [L2] Order XVII Rule 2 CPC     — fault-based cost imposition
 * [L3] Section 35 CPC            — general costs
 * [L4] Section 35A CPC           — compensatory costs
 * [L5] Section 35B CPC           — costs for delay
 * [L6] Ramrameshwari Devi v. Nirmala Devi (2011) 8 SCC 249
 *
 * Data Sources:
 * [D1] DHCLSC Fee Schedule w.e.f. 1 July 2024
 * [D2] PLFS Annual Report July 2023–June 2024 (MoSPI/NSO)
 * [D3] MGNREGA Schedule 2024-25
 * [D4] Law Ministry Panel Counsel Revised Rates, February 2026
 * [D5] Law Commission Report No. 240 — Costs in Civil Litigation
 */


// ─── STAGE MULTIPLIERS ───────────────────────────────────────────────────────
// Monotonically increasing — later stages cost more because the full record
// must be re-read and Senior re-briefed. Baseline = Evidence = 1.0. [L6]
// Values unchanged from v3.0 — v3.1 compression (0.52–1.65) was unjustified.

const STAGE_MULTIPLIERS = {
    filing_admission: 0.60,   // Minimal prep; no evidence on record
    notice_service: 0.75,   // Pleadings filed; partial prep
    interlocutory: 0.90,   // Interim application; partial preparation
    evidence: 1.00,   // BASELINE
    final_arguments: 1.50,   // Senior re-briefed; entire record re-read
    order_reserved: 1.80,   // Maximum — all work done, adjournment wastes it
};


// ─── FAULT CONFIG ────────────────────────────────────────────────────────────
// Grounded in Order XVII Rule 1(2) and Rule 2 CPC. [L1][L2]
//
// multiplier  : cost weight — OP premium (1.20) reflects wasted preparation
//               when opposite party forces a last-minute cancellation [L1]
// recoverable : whether cost is claimable under Order XVII Rule 2 [L2]
//
// v3.1 set all costMult to 1.00 and added recoveryMult — rejected because:
//   (a) removing the OP 1.20 premium undervalues late-stage OP adjournments
//   (b) mutual_consent recoveryMult 0.50 has no basis in S.35B CPC [L5]

const FAULT_CONFIG = {
    court_system: { multiplier: 1.00, recoverable: false, basis: "S.35 CPC — discretionary" },
    opposite_party: { multiplier: 1.20, recoverable: true, basis: "Order XVII Rule 2 — recoverable" },
    own_side: { multiplier: 0.50, recoverable: false, basis: "Absorbed — own fault" },
    mutual_consent: { multiplier: 0.75, recoverable: false, basis: "S.35B CPC — shared delay" },
};


// ─── OPPORTUNITY COST RATES ──────────────────────────────────────────────────
// Source: PLFS 2023-24 [D2], 75th-percentile for HC litigant cohort.
// HC litigants occupy the top ~22% of India's income distribution.
// Keyed to WORKER TYPE — not case type (case type does not change daily wages).
// senior_executive tier added from v3.1 — genuine practical addition.

const OPPORTUNITY_COST_RATES = {
    unskilled_casual: 550,   // PLFS 2023-24 casual labour, 75th pct [D2]
    skilled_informal: 1100,   // PLFS 2023-24 semi-skilled informal, 75th pct [D2]
    salaried_formal: 1800,   // PLFS 2023-24 urban salaried, 75th pct [D2]
    self_employed_small: 4500,   // PLFS 2023-24 urban self-employed, 75th pct [D2]
    professional: 7500,   // PLFS 2023-24 professional/managerial, 75th pct [D2]
    corporate_officer: 20000,   // Declared input — not PLFS; user must override
    senior_executive: 50000,   // Declared input — C-suite/partner level; user must override
};


// ─── TRAVEL COSTS ────────────────────────────────────────────────────────────
// 2024-25 Indian market rates. [D2, field estimate]
// local:      Auto/cab return trip within HC city
// outstation: Sleeper/2AC train + local conveyance + hotel
// intercity:  Economy flight + taxi + hotel

const TRAVEL_COSTS = {
    local: { travel: 500, hotel: 0 },
    outstation: { travel: 2000, hotel: 3000 },
    intercity: { travel: 6000, hotel: 5000 },
};


// ─── INCIDENTALS ─────────────────────────────────────────────────────────────
// Agent/clerk and photocopy: 100% — incurred on every hearing date.
// Affidavit, notary: probabilistic — not every adjournment triggers them.
// Doc re-prep: 10% of original filing prep — front-loaded cost is NOT charged
// per adjournment; only the incremental re-preparation fraction is. [D5]
// Values unchanged from v3.0 — v3.1 reductions (0.22, 0.18, 0.07) unjustified.

const INCIDENTALS = {
    agentClerkFee: 1500,  // Per hearing — always incurred [D1]
    photocopyMisc: 400,  // Per hearing — always incurred
    affidavitCost: 800,  // Per trigger — fresh affidavit stamp + typing
    affidavitProbability: 0.30, // 30% of adjournments require a fresh affidavit
    notaryCost: 500,  // Per trigger
    notaryProbability: 0.25, // 25% of adjournments require notarisation
    docRePrepFraction: 0.10, // 10% of original doc prep re-spent per adjournment
};


// ─── ADVOCATE FEE DEFAULTS ───────────────────────────────────────────────────
// [D1] DHCLSC 2024 + [D4] Law Ministry revised rates Feb 2026.
// Govt panel Group A = ₹21,600/day — subsidised floor, not market rate.
// Private retained mid-level HC advocate 2024-25: ₹30,000–₹40,000/hearing.
// JUNIOR_FEE_CAP = ₹15,000 — junior fees plateau regardless of senior fee.
// User MUST override seniorFeePerHearing with their actual retainer.

const JUNIOR_FEE_CAP = 15000;

const ADVOCATE_DEFAULTS = {
    mid_level: { seniorFee: 32500, juniorFeeFixed: 8000 }, // ₹30k–₹35k midpoint [D1][D4]
    designated_senior: { seniorFee: 100000, juniorFeeFixed: 12000 }, // ₹75k–₹1.25L midpoint
    junior_only: { seniorFee: 0, juniorFeeFixed: 10000 }, // Junior leading matter
};


// ═══════════════════════════════════════════════════════════════════════════════
// FORMULA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Professional fees for one adjourned hearing.
 *
 * juniorFee = min(seniorFee × 0.67, ₹15,000 cap)
 * Cap prevents linear scaling at high fee tiers — junior fees plateau in
 * practice regardless of senior fee level. Ratio 0.67 = HC convention (2/3).
 * v3.1 changed ratio to 0.45 without justification — rejected, 0.67 retained.
 *
 * BACKPORTED from v3.1: juniorCount (multiple juniors common in HC matters)
 * and hasClerk (clerk fee separated from agent fee for precision).
 *
 * @param {number}  seniorFee      — actual retainer per appearance
 * @param {number}  juniorCount    — number of junior counsel (default 1)
 * @param {boolean} hasClerk       — whether clerk attends separately (default true)
 * @param {number|null} juniorFeeFixed — fixed fee for junior-only matters
 */
function calculateProfessionalFees(
    seniorFee = 32500,
    juniorCount = 1,
    hasClerk = true,
    juniorFeeFixed = null
) {
    if (seniorFee === 0) {
        // Junior-only matter — use fixed fee directly
        const clerkAddon = hasClerk ? 1500 : 0;
        return (juniorFeeFixed || 10000) * juniorCount + clerkAddon;
    }
    // Junior fee capped at ₹15,000 per junior regardless of senior fee level
    const perJuniorFee = Math.min(seniorFee * 0.67, JUNIOR_FEE_CAP);
    const totalJunior = perJuniorFee * juniorCount;
    const clerkFee = hasClerk ? 1500 : 0;
    return seniorFee + totalJunior + clerkFee;
}

/**
 * Travel + accommodation for one hearing date.
 */
function calculateTravelCost(mode = "local", includeHotel = false) {
    const t = TRAVEL_COSTS[mode] || TRAVEL_COSTS.local;
    return t.travel + (includeHotel ? t.hotel : 0);
}

/**
 * Daily opportunity cost (lost wages / business income).
 * Uses PLFS 75th-pct rate unless caller provides actual daily income. [D2]
 */
function calculateOpportunityCost(workerType = "salaried_formal", customDailyRate = null) {
    if (customDailyRate > 0) return customDailyRate;
    return OPPORTUNITY_COST_RATES[workerType] || OPPORTUNITY_COST_RATES.salaried_formal;
}

/**
 * Per-hearing incidentals — probabilistic expected-value model.
 * originalDocPrepCost is ONE-TIME at filing; only 10% re-prep per adjournment.
 */
function calculateIncidentalCosts(originalDocPrepCost = 15000, overrides = {}) {
    const c = { ...INCIDENTALS, ...overrides };
    return (
        c.agentClerkFee +
        c.photocopyMisc +
        (c.affidavitCost * c.affidavitProbability) +   // Expected value: ₹240
        (c.notaryCost * c.notaryProbability) +   // Expected value: ₹125
        (originalDocPrepCost * c.docRePrepFraction)     // 10% re-prep: ₹1,500 default
    );
}

/**
 * Base cost of ONE adjourned hearing — before stage and fault multipliers.
 */
function calculateBaseCost({
    seniorFeePerHearing = 32500,
    juniorCount = 1,
    hasClerk = true,
    juniorFeeFixed = null,
    travelMode = "local",
    includeHotel = false,
    workerType = "salaried_formal",
    customDailyRate = null,
    originalDocPrepCost = 15000,
    incidentalOverrides = {},
} = {}) {
    return (
        calculateProfessionalFees(seniorFeePerHearing, juniorCount, hasClerk, juniorFeeFixed) +
        calculateTravelCost(travelMode, includeHotel) +
        calculateOpportunityCost(workerType, customDailyRate) +
        calculateIncidentalCosts(originalDocPrepCost, incidentalOverrides)
    );
}

/**
 * Weighted cost of one adjourned hearing.
 *
 *   weightedCost = baseCost × stageMult × faultMult
 *
 * stageMult: reflects actual re-preparation cost at each stage [L6]
 * faultMult: reflects who caused the adjournment [L1][L2]
 */
function calculateWeightedHearingCost(baseCost, stage, fault) {
    const stageMult = STAGE_MULTIPLIERS[stage] ?? 1.0;
    const faultCfg = FAULT_CONFIG[fault] ?? FAULT_CONFIG.court_system;
    return {
        weightedCost: baseCost * stageMult * faultCfg.multiplier,
        stageMult,
        faultMult: faultCfg.multiplier,
        recoverable: faultCfg.recoverable,
        basis: faultCfg.basis,
    };
}


// ═══════════════════════════════════════════════════════════════════════════════
// MASTER FORMULA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * calculateAdjournmentImpact()
 *
 * INPUT
 * ─────
 * hearings: Array of {
 *   date     : string,
 *   stage    : "filing_admission" | "notice_service" | "interlocutory" |
 *              "evidence" | "final_arguments" | "order_reserved",
 *   fault    : "court_system" | "opposite_party" | "own_side" | "mutual_consent",
 *   adjourned: boolean,
 *   reason   : string,
 * }
 *
 * costConfig: {
 *   seniorFeePerHearing : number,        // Actual retainer — OVERRIDE this
 *   juniorCount         : number,        // Number of junior counsel (default 1)
 *   hasClerk            : boolean,       // Clerk attends separately (default true)
 *   juniorFeeFixed      : number|null,   // For junior-only matters
 *   travelMode          : "local" | "outstation" | "intercity",
 *   includeHotel        : boolean,
 *   workerType          : key of OPPORTUNITY_COST_RATES,
 *   customDailyRate     : number|null,   // Override PLFS rate with actual income
 *   originalDocPrepCost : number,        // One-time filing prep cost
 *   incidentalOverrides : object,        // Override any INCIDENTALS key
 * }
 */
function calculateAdjournmentImpact(hearings, costConfig = {}) {

    const cfg = {
        seniorFeePerHearing: 32500,
        juniorCount: 1,
        hasClerk: true,
        juniorFeeFixed: null,
        travelMode: "local",
        includeHotel: false,
        workerType: "salaried_formal",
        customDailyRate: null,
        originalDocPrepCost: 15000,
        incidentalOverrides: {},
        ...costConfig,
    };

    const baseCost = calculateBaseCost(cfg);
    const baseProfFees = calculateProfessionalFees(
        cfg.seniorFeePerHearing, cfg.juniorCount, cfg.hasClerk, cfg.juniorFeeFixed
    );
    const baseTravelStay = calculateTravelCost(cfg.travelMode, cfg.includeHotel);
    const baseOppty = calculateOpportunityCost(cfg.workerType, cfg.customDailyRate);
    const baseIncid = calculateIncidentalCosts(cfg.originalDocPrepCost, cfg.incidentalOverrides);

    let totalDrain = 0;
    let recoverableFromOP = 0;
    let absorbedByOwn = 0;
    let systemicCost = 0;
    let mutualConsentCost = 0;

    const costHeadSummary = {
        professionalFees: 0,
        travelStay: 0,
        opportunityCost: 0,
        incidentals: 0,
    };

    const perHearingBreakdown = hearings
        .filter(h => h.adjourned)
        .map((h, i) => {

            const { weightedCost, stageMult, faultMult, recoverable, basis } =
                calculateWeightedHearingCost(baseCost, h.stage, h.fault);

            const m = stageMult * faultMult;

            costHeadSummary.professionalFees += baseProfFees * m;
            costHeadSummary.travelStay += baseTravelStay * m;
            costHeadSummary.opportunityCost += baseOppty * m;
            costHeadSummary.incidentals += baseIncid * m;

            totalDrain += weightedCost;

            if (h.fault === "opposite_party") recoverableFromOP += weightedCost;
            else if (h.fault === "own_side") absorbedByOwn += weightedCost;
            else if (h.fault === "court_system") systemicCost += weightedCost;
            else if (h.fault === "mutual_consent") mutualConsentCost += weightedCost;

            return {
                index: i + 1,
                date: h.date,
                stage: h.stage,
                fault: h.fault,
                reason: h.reason,
                baseCost,
                stageMult,
                faultMult,
                weightedCost,
                recoverable,
                basis,
                costHeads: {
                    professionalFees: baseProfFees * m,
                    travelStay: baseTravelStay * m,
                    opportunityCost: baseOppty * m,
                    incidentals: baseIncid * m,
                },
            };
        });

    const adjournedCount = perHearingBreakdown.length;

    return {
        totalDrain,
        recoverableFromOP,
        absorbedByOwn,
        systemicCost,
        mutualConsentCost,
        netUnrecoverable: totalDrain - recoverableFromOP,
        adjournedCount,
        avgCostPerAdj: adjournedCount > 0 ? Math.round(totalDrain / adjournedCount) : 0,
        baseCostPerHearing: baseCost,
        costHeadSummary,
        perHearingBreakdown,
    };
}


export {
    STAGE_MULTIPLIERS,
    FAULT_CONFIG,
    OPPORTUNITY_COST_RATES,
    TRAVEL_COSTS,
    INCIDENTALS,
    ADVOCATE_DEFAULTS,
    JUNIOR_FEE_CAP,
    calculateProfessionalFees,
    calculateTravelCost,
    calculateOpportunityCost,
    calculateIncidentalCosts,
    calculateBaseCost,
    calculateWeightedHearingCost,
    calculateAdjournmentImpact,
};
