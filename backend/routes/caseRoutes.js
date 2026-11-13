const express = require('express');
const ecourtsCodes = require('../data/ecourts-codes.json');
const { questionsForStage } = require('../data/stage-questions');
const { HttpError } = require('../middleware/errorHandler');
const { cnrParam, requireString, numberInRange } = require('../middleware/validate');
const { toPublicCase } = require('../services/serialize');
const { hearingStats, lastHearing } = require('../services/hearings');
const { daysBetween, todayISO } = require('../services/ecourts/dates');
const cost = require('../services/costModel');

const STAGES = ecourtsCodes.stages;
const stageInfo = (n) => STAGES[Math.min(Math.max(n || 1, 1), STAGES.length) - 1];

function createCaseRouter({ store, now = () => new Date() }) {
    const router = express.Router();

    // Loads req.caseData for every :cnr route (404 when unknown/expired).
    router.param('cnr', cnrParam);
    async function loadCase(req, res, next) {
        const caseData = await store.getCase(req.cnr);
        if (!caseData) {
            return next(new HttpError(404, 'case_not_found', 'Case not found. Live cases expire after a while — please search for it again.'));
        }
        req.caseData = caseData;
        next();
    }

    // ── Literal routes first ─────────────────────────────────────────────────────────────────────
    router.get('/demo-cases', (req, res) => {
        res.json(store.listDemo().map((c) => ({
            cnr: c.cnr, title: c.title, court: c.court, currentStage: c.currentStage, totalStages: c.totalStages,
            totalHearings: c.hearings.length, nextHearingDate: c.nextHearingDate,
        })));
    });

    router.get('/cost-config', (req, res) => res.json(cost.getCostConfigOptions()));

    router.post('/case/search', (req, res) => {
        const body = req.body ?? {};
        const type = requireString(body.type, 'type', { max: 20 });
        const query = requireString(body.query, 'query', { max: 100 });
        if (!['party', 'advocate'].includes(type)) {
            throw new HttpError(400, 'invalid_request', 'type must be "party" or "advocate".', { validTypes: ['party', 'advocate'] });
        }
        const results = store.searchDemo(type, query);
        res.json({
            type, query, count: results.length, scope: 'demo cases only',
            results: results.map((c) => ({ cnr: c.cnr, title: c.title, court: c.court, currentStage: c.currentStage, totalStages: c.totalStages, nextHearingDate: c.nextHearingDate })),
        });
    });

    // ── Per-case routes ──────────────────────────────────────────────────────────────────────────
    router.get('/case/:cnr', loadCase, (req, res) => res.json(toPublicCase(req.caseData)));

    router.get('/case/:cnr/hearings', loadCase, (req, res) => {
        const pub = toPublicCase(req.caseData);
        res.json({ cnr: pub.cnr, title: pub.title, stats: pub.hearingStats, hearings: pub.hearings });
    });

    router.get('/case/:cnr/stage', loadCase, (req, res) => {
        const c = req.caseData;
        const current = c.currentStage || 1;
        const stages = STAGES.map((s) => ({
            ...s,
            status: s.stageNumber < current ? 'completed' : s.stageNumber === current ? 'current' : 'upcoming',
            isCurrent: s.stageNumber === current,
        }));
        const info = stageInfo(current);
        res.json({
            cnr: c.cnr, title: c.title, currentStage: current, totalStages: STAGES.length,
            stagesRemaining: STAGES.length - current,
            estimatedMonthsRemaining: STAGES.filter((s) => s.stageNumber > current).reduce((sum, s) => sum + s.avgMonthsDistrict, 0),
            currentStageName: info.name, currentStageDescription: info.description, stages,
        });
    });

    router.get('/case/:cnr/questions', loadCase, (req, res) => {
        const c = req.caseData;
        const stage = c.currentStage || 1;
        const info = stageInfo(stage);
        const last = lastHearing(c.hearings, todayISO(now()));

        const contextual = [];
        if (last) {
            if (last.classification === 'adjourned_lawyer' && last.faultParty === 'own_side') {
                contextual.push({ q: 'Why were you absent at the last hearing? Were you appearing for another client?', why: 'The last adjournment was recorded against our side; it is fair to ask what is being done to avoid a repeat.' });
            }
            if (last.classification === 'adjourned_other' && last.faultParty === 'opposite_party') {
                contextual.push({ q: 'The opposite party caused the last adjournment. Can we ask the court for costs against them?', why: 'Courts can impose costs for avoidable adjournments (Order XVII CPC), but only if the request is made.' });
            }
            if (/nnfr/i.test(last.business || '')) {
                contextual.push({ q: 'The case was not reached last time. Can we ask for an early date?', why: 'A heavy board is the most common reason for a lost date; an early-date application sometimes helps.' });
            }
        }

        res.json({
            cnr: c.cnr, stage, stageName: info.name, stageDescription: info.description,
            questions: questionsForStage(stage), contextualQuestions: contextual,
            lastHearingContext: last ? { date: last.date, outcome: last.businessTranslated, classification: last.classification } : null,
        });
    });

    router.get('/case/:cnr/prep', loadCase, (req, res) => {
        const c = req.caseData;
        const today = todayISO(now());
        const last = lastHearing(c.hearings, today);
        const info = stageInfo(c.currentStage || 1);
        const daysUntil = c.nextHearingDate ? daysBetween(today, c.nextHearingDate) : null;

        const checklist = [
            'Confirm your lawyer knows about the hearing date',
            `Prepare for: ${c.nextHearingPurpose || 'the next hearing'}`,
            'Carry all original documents and previous court orders',
            'Reach court at least 30 minutes before the scheduled time',
        ];
        if (last && last.classification === 'adjourned_lawyer' && last.faultParty === 'own_side') {
            checklist.push('⚠️ Your lawyer was absent last time. Confirm their availability.');
        }

        res.json({
            cnr: c.cnr, title: c.title, nextHearingDate: c.nextHearingDate, nextHearingPurpose: c.nextHearingPurpose,
            daysUntilNextHearing: daysUntil,
            currentStage: { number: c.currentStage, name: info.name, whatToExpect: info.description },
            lastHearing: last ? { date: last.date, outcome: last.businessTranslated, classification: last.classification } : null,
            preparationChecklist: checklist,
            questionsToAsk: questionsForStage(c.currentStage || 1).slice(0, 3),
        });
    });

    router.get('/case/:cnr/whatsapp', loadCase, (req, res) => {
        const c = req.caseData;
        const info = stageInfo(c.currentStage || 1);
        const message = [
            '⚖️ Vakalat update', '',
            `*${c.title}*`,
            `Court: ${c.court}`,
            `Next hearing: *${c.nextHearingDate || 'Not scheduled'}*`,
            `Purpose: ${c.nextHearingPurpose || '-'}`, '',
            `Stage: ${c.currentStage}/8 — ${info.name}`,
            `Hearings so far: ${c.hearings.length}`, '',
            'Tracked with Vakalat (not legal advice)',
        ].join('\n');
        res.json({ cnr: c.cnr, title: c.title, nextHearingDate: c.nextHearingDate, message, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}` });
    });

    router.get('/case/:cnr/summary', loadCase, (req, res) => {
        const pub = toPublicCase(req.caseData);
        const info = stageInfo(pub.currentStage || 1);
        const est = cost.estimateCaseCost(req.caseData); // default assumptions
        res.json({
            cnr: pub.cnr, title: pub.title, court: pub.court, state: pub.state, district: pub.district, caseType: pub.caseType,
            filedDate: pub.filedDate, registrationDate: pub.registrationDate,
            petitioner: pub.petitioner, petitionerAdvocate: pub.petitionerAdvocate,
            respondent: pub.respondent, respondentAdvocate: pub.respondentAdvocate,
            acts: pub.acts || [], currentStage: pub.currentStage, totalStages: STAGES.length,
            stageName: info.name, stageDescription: info.description,
            nextHearingDate: pub.nextHearingDate, nextHearingPurpose: pub.nextHearingPurpose,
            hearingStats: pub.hearingStats,
            estimatedCost: { amount: est.totalDrain, adjournments: est.adjournedCount, assumptions: 'default fee and wage assumptions' },
            topQuestions: questionsForStage(pub.currentStage || 1).slice(0, 3),
            recentHearings: pub.hearings.slice(-5).reverse(),
            source: pub.source, cachedAt: pub.cachedAt,
        });
    });

    router.post('/case/:cnr/cost', loadCase, (req, res) => {
        const b = req.body ?? {};
        const opts = cost.getCostConfigOptions();
        const lim = opts.limits;
        const workerType = b.workerType === undefined ? cost.DEFAULT_CONFIG.workerType : String(b.workerType);
        const travelMode = b.travelMode === undefined ? cost.DEFAULT_CONFIG.travelMode : String(b.travelMode);
        if (!cost.OPPORTUNITY_COST_RATES[workerType]) throw new HttpError(400, 'invalid_request', `workerType must be one of: ${Object.keys(cost.OPPORTUNITY_COST_RATES).join(', ')}`);
        if (!cost.TRAVEL_COSTS[travelMode]) throw new HttpError(400, 'invalid_request', `travelMode must be one of: ${Object.keys(cost.TRAVEL_COSTS).join(', ')}`);

        const config = {
            seniorFeePerHearing: numberInRange(b.seniorFeePerHearing, 'seniorFeePerHearing', { ...lim.seniorFeePerHearing, fallback: cost.DEFAULT_SENIOR_FEE }),
            juniorCount: Math.round(numberInRange(b.juniorCount, 'juniorCount', { ...lim.juniorCount, fallback: 0 })),
            customDailyRate: numberInRange(b.customDailyRate, 'customDailyRate', { ...lim.customDailyRate, fallback: null }),
            workerType, travelMode,
        };
        const result = cost.estimateCaseCost(req.caseData, config);
        res.json({ cnr: req.caseData.cnr, assumptions: config, disclaimer: opts.disclaimer, ...result, stats: hearingStats(req.caseData.hearings) });
    });

    return router;
}

module.exports = { createCaseRouter };
