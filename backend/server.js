const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initFirebase, getDb } = require('./config/firebase');
const { DemoCaseStore } = require('./data/demo-cases');
const ecourtsCodes = require('./data/ecourts-codes.json');
const { fetchCaptcha, searchByCNR, closeBrowser } = require('./services/ecourts');

// Initialize Firebase (falls back to demo mode if no credentials)
initFirebase();

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory demo store (used when Firebase is unavailable or for demo cases)
const demoStore = new DemoCaseStore();

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Make demoStore and db available to routes
app.set('demoStore', demoStore);
app.set('ecourtsCodes', ecourtsCodes);

// In-memory cache for live-scraped cases (until Firebase is connected)
const liveCaseCache = new Map();

// Helper: resolve case from demo store or live cache
function resolveCase(cnr) {
    const upper = cnr.toUpperCase();
    return demoStore.getCase(upper) || liveCaseCache.get(upper) || null;
}


// --------------- Routes ---------------

const pdfRoutes = require('./routes/pdfRoutes');
app.use('/api/order', pdfRoutes);

// Health check
app.get('/api/health', (req, res) => {
    const db = getDb();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        firebase: db ? 'connected' : 'demo-mode (in-memory)',
        demoCasesLoaded: demoStore.getAllCases().length,
        version: '1.0.0'
    });
});

// ---- Phase A-1: Code Translation ----
app.get('/api/translate', (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ error: 'Missing "code" query parameter' });
    }

    const upper = code.toUpperCase().trim();

    // Check business codes
    if (ecourtsCodes.businessCodes[upper]) {
        return res.json({ code: upper, type: 'business', ...ecourtsCodes.businessCodes[upper] });
    }

    // Check stage codes
    if (ecourtsCodes.stageCodes[upper]) {
        return res.json({ code: upper, type: 'stage', ...ecourtsCodes.stageCodes[upper] });
    }

    return res.status(404).json({ error: `Unknown code: ${code}`, suggestion: 'This code is not in our database yet. Try GET /api/translate/all to see all known codes.' });
});

app.get('/api/translate/all', (req, res) => {
    res.json(ecourtsCodes);
});


// ---- Phase F-2 + F-2.1: CAPTCHA Relay (District + High Court) ----

// Step 1: Get a CAPTCHA image — pass ?courtType=district or ?courtType=highcourt
app.get('/api/captcha', async (req, res) => {
    const courtType = req.query.courtType || 'district';
    try {
        const result = await fetchCaptcha(courtType);
        res.json({
            sessionId: result.sessionId,
            courtType: result.courtType,
            captchaDataUrl: result.captchaDataUrl,
            expiresIn: '10 minutes',
            hint: 'Solve the CAPTCHA and submit via POST /api/case/cnr/live'
        });
    } catch (error) {
        res.status(502).json({
            error: `Failed to fetch CAPTCHA from eCourts (${courtType})`,
            message: error.message,
            hint: 'eCourts may be temporarily unavailable. Use demo cases in the meantime.'
        });
    }
});

// Step 2: Submit CNR + solved CAPTCHA for live lookup
app.post('/api/case/cnr/live', async (req, res) => {
    const { cnr, captcha, sessionId } = req.body;

    if (!cnr || !captcha || !sessionId) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: { cnr: '16-digit CNR number', captcha: 'Solved CAPTCHA text', sessionId: 'From GET /api/captcha' }
        });
    }

    try {
        const result = await searchByCNR(cnr, captcha, sessionId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Cache the result in memory
        liveCaseCache.set(cnr.toUpperCase(), result.data);

        // Also make it accessible via all other endpoints
        demoStore.setCase(cnr.toUpperCase(), result.data);

        res.json({
            source: 'ecourts_live',
            fresh: true,
            data: result.data
        });
    } catch (error) {
        res.status(502).json({
            error: 'Failed to search CNR on eCourts',
            message: error.message
        });
    }
});

// ---- Clear a cached case (force re-scrape next time) ----
app.delete('/api/case/cache/:cnr', (req, res) => {
    const cnr = req.params.cnr.toUpperCase();
    const hadIt = liveCaseCache.has(cnr) || demoStore.getCase(cnr) !== null;
    liveCaseCache.delete(cnr);
    demoStore.removeCase && demoStore.removeCase(cnr);
    res.json({ cleared: cnr, wasPresent: hadIt });
});

// ---- Case Lookup (demo + live cache) ----
app.get('/api/case/:cnr', (req, res) => {
    const { cnr } = req.params;
    const caseData = resolveCase(cnr);

    if (!caseData) {
        return res.status(404).json({
            error: `Case not found: ${cnr}`,
            hint: 'Use GET /api/demo-cases for demo CNRs, or use GET /api/captcha + POST /api/case/cnr/live for a live eCourts lookup.'
        });
    }

    res.json(caseData);
});

// ---- List all demo cases ----
app.get('/api/demo-cases', (req, res) => {
    const cases = demoStore.getAllCases().map(c => ({
        cnr: c.cnr,
        title: c.title,
        court: c.court,
        currentStage: c.currentStage,
        totalStages: c.totalStages,
        totalHearings: c.hearings.length,
        nextHearingDate: c.nextHearingDate
    }));
    res.json(cases);
});

// ---- Phase A-3: Search (demo mode) ----
app.post('/api/case/search', (req, res) => {
    const { type, query } = req.body;

    if (!type || !query) {
        return res.status(400).json({ error: 'Missing "type" and "query" in request body', validTypes: ['party', 'advocate', 'casenumber'] });
    }

    let results;
    switch (type) {
        case 'party':
            results = demoStore.searchByPartyName(query);
            break;
        case 'advocate':
            results = demoStore.searchByAdvocate(query);
            break;
        default:
            return res.status(400).json({ error: `Unknown search type: ${type}`, validTypes: ['party', 'advocate'] });
    }

    res.json({
        type,
        query,
        count: results.length,
        results: results.map(c => ({
            cnr: c.cnr,
            title: c.title,
            court: c.court,
            currentStage: c.currentStage,
            totalStages: c.totalStages,
            nextHearingDate: c.nextHearingDate
        }))
    });
});

// ---- Phase B-1: Hearing History (classified) ----
app.get('/api/case/:cnr/hearings', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const hearings = caseData.hearings;
    const stats = {
        total: hearings.length,
        productive: hearings.filter(h => h.classification === 'productive').length,
        adjournedLawyer: hearings.filter(h => h.classification === 'adjourned_lawyer').length,
        adjournedCourt: hearings.filter(h => h.classification === 'adjourned_court').length,
        adjournedOther: hearings.filter(h => h.classification === 'adjourned_other').length,
    };
    stats.totalAdjourned = stats.adjournedLawyer + stats.adjournedCourt + stats.adjournedOther;
    stats.adjournmentRate = stats.total > 0 ? Math.round((stats.totalAdjourned / stats.total) * 100) : 0;

    res.json({ cnr: caseData.cnr, title: caseData.title, stats, hearings });
});

// ---- Phase B-2: Financial Drain Calculator ----
app.post('/api/case/:cnr/drain', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const { lawyerFeePerHearing = 15000, travelCost = 500, lostWagesPerDay = 1000 } = req.body;

    const hearings = caseData.hearings;
    const totalHearings = hearings.length;
    const productive = hearings.filter(h => h.classification === 'productive').length;
    const adjourned = totalHearings - productive;

    const lawyerFeesWasted = adjourned * lawyerFeePerHearing;
    const travelWasted = adjourned * travelCost;
    const wagesLost = adjourned * lostWagesPerDay;
    const totalWasted = lawyerFeesWasted + travelWasted + wagesLost;

    const caseAgeYears = ((new Date() - new Date(caseData.filedDate)) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);

    res.json({
        cnr: caseData.cnr,
        title: caseData.title,
        caseAgeYears: parseFloat(caseAgeYears),
        summary: {
            totalHearings,
            productiveHearings: productive,
            adjournedHearings: adjourned,
            adjournmentRate: `${Math.round((adjourned / totalHearings) * 100)}%`
        },
        costs: {
            lawyerFeePerHearing,
            travelCost,
            lostWagesPerDay,
        },
        drain: {
            lawyerFeesWasted,
            travelWasted,
            wagesLost,
            totalWasted,
            formatted: `₹${totalWasted.toLocaleString('en-IN')}`
        },
        insight: adjourned > productive
            ? `⚠️ Your case has been adjourned ${adjourned} times vs only ${productive} productive hearings. An estimated ₹${totalWasted.toLocaleString('en-IN')} has been wasted on non-productive court dates over ${caseAgeYears} years.`
            : `Your case has a relatively good productive-to-adjournment ratio.`
    });
});

// ---- Phase C-1: Lawyer Stats (per case) ----
app.get('/api/case/:cnr/lawyer-stats', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const hearings = caseData.hearings;
    const productive = hearings.filter(h => h.classification === 'productive').length;
    const lawyerAdjourned = hearings.filter(h => h.classification === 'adjourned_lawyer').length;
    const otherAdjourned = hearings.filter(h => h.classification !== 'productive' && h.classification !== 'adjourned_lawyer').length;

    const lawyerAdjournmentRate = hearings.length > 0 ? Math.round((lawyerAdjourned / hearings.length) * 100) : 0;
    const courtAvgRate = 28; // hardcoded benchmark from NJDG data

    let insight = '';
    if (lawyerAdjournmentRate > courtAvgRate * 1.5) {
        insight = `⚠️ This advocate's adjournment rate (${lawyerAdjournmentRate}%) is significantly higher than the court average (${courtAvgRate}%). Consider discussing case progress directly.`;
    } else if (lawyerAdjournmentRate > courtAvgRate) {
        insight = `This advocate's adjournment rate (${lawyerAdjournmentRate}%) is slightly above the court average (${courtAvgRate}%).`;
    } else {
        insight = `This advocate's adjournment rate (${lawyerAdjournmentRate}%) is within the court average (${courtAvgRate}%).`;
    }

    res.json({
        cnr: caseData.cnr,
        advocate: caseData.petitionerAdvocate,
        totalHearings: hearings.length,
        productive,
        adjournedByLawyer: lawyerAdjourned,
        adjournedByOthers: otherAdjourned,
        lawyerAdjournmentRate: `${lawyerAdjournmentRate}%`,
        courtAverageRate: `${courtAvgRate}%`,
        insight
    });
});

// ---- Phase C-4: "What to Ask Your Lawyer" ----
const stageQuestions = {
    1: [
        "Has my case been properly filed with all required documents?",
        "Is there any deficiency in the filing that needs to be corrected?",
        "When can I expect the case to be admitted?",
        "Are there any court fees still outstanding?",
        "Should we file for any urgent interim relief?"
    ],
    2: [
        "Has the court admitted our case? If not, what are the objections?",
        "Is the opposite party likely to challenge the admission?",
        "How strong is our case at this stage based on the initial filing?",
        "Should we apply for any interim orders at admission?",
        "How long will the admission process typically take in this court?"
    ],
    3: [
        "Has the notice been served on the opposite party?",
        "Has the opposite party filed their written statement?",
        "Is the written statement raising any unexpected defences?",
        "Should we file a reply to their written statement?",
        "What is the deadline for them to file the written statement?"
    ],
    4: [
        "What issues has the court framed in our case?",
        "Are the framed issues favourable to our side?",
        "Should we challenge any of the framed issues?",
        "What evidence do we need for each framed issue?",
        "How does framing of issues affect our overall strategy?"
    ],
    5: [
        "Which witnesses have we listed and when will they be examined?",
        "Have all our documents been properly marked as exhibits?",
        "What is the strongest piece of evidence we have and is it submitted?",
        "What will happen if a witness fails to appear on the next date?",
        "How many more hearings do you estimate before we finish our evidence?"
    ],
    6: [
        "What evidence is the other side presenting?",
        "Are we prepared for cross-examination of their witnesses?",
        "Are they introducing any surprise documents or witnesses?",
        "Can we object to any of their evidence?",
        "How does their evidence compare to ours in strength?"
    ],
    7: [
        "What are the main points you plan to argue?",
        "Have you prepared written arguments to submit?",
        "What are the key case laws you are citing in our favour?",
        "What are the weakest points the other side might exploit?",
        "How many hearing dates do you expect for final arguments?"
    ],
    8: [
        "When is the judgment expected to be pronounced?",
        "Based on the arguments, what is your honest assessment of the outcome?",
        "If the judgment is against us, what are our appeal options?",
        "How long do we have to file an appeal after judgment?",
        "Should we prepare for execution proceedings if we win?"
    ]
};

app.get('/api/case/:cnr/questions', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const stage = caseData.currentStage;
    const stageInfo = ecourtsCodes.stages[stage - 1] || ecourtsCodes.stages[0];
    const questions = stageQuestions[stage] || stageQuestions[5];

    // Add context-specific questions based on last hearing
    const lastHearing = caseData.hearings[caseData.hearings.length - 1];
    const extraQuestions = [];
    if (lastHearing) {
        if (lastHearing.classification === 'adjourned_lawyer') {
            extraQuestions.push("Why were you absent at the last hearing? Were you representing another client?");
        }
        if (lastHearing.classification === 'adjourned_other') {
            extraQuestions.push("The opposite party caused the last adjournment. Can we move for costs against them?");
        }
        if (lastHearing.business === 'NNFR') {
            extraQuestions.push("The case was not heard last time due to heavy board. Can we request an early date or a supplementary cause list?");
        }
    }

    res.json({
        cnr: caseData.cnr,
        stage,
        stageName: stageInfo.name,
        stageDescription: stageInfo.description,
        questions,
        contextualQuestions: extraQuestions,
        lastHearingContext: lastHearing ? {
            date: lastHearing.date,
            outcome: lastHearing.businessTranslated,
            classification: lastHearing.classification
        } : null
    });
});

// ---- Phase D-1: Case Stage ----
app.get('/api/case/:cnr/stage', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const currentStage = caseData.currentStage;
    const stages = ecourtsCodes.stages.map(s => ({
        ...s,
        status: s.stageNumber < currentStage ? 'completed' : s.stageNumber === currentStage ? 'current' : 'upcoming',
        isCurrent: s.stageNumber === currentStage
    }));

    const currentStageInfo = stages.find(s => s.isCurrent);
    const stagesRemaining = ecourtsCodes.stages.length - currentStage;
    const monthsRemaining = ecourtsCodes.stages
        .filter(s => s.stageNumber >= currentStage)
        .reduce((sum, s) => sum + s.avgMonthsDistrict, 0);

    res.json({
        cnr: caseData.cnr,
        title: caseData.title,
        currentStage,
        totalStages: 8,
        stagesRemaining,
        estimatedMonthsRemaining: monthsRemaining,
        currentStageName: currentStageInfo?.name,
        currentStageDescription: currentStageInfo?.description,
        stages
    });
});

// ---- Phase D-3: Pre-Hearing Prep ----
app.get('/api/case/:cnr/prep', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const currentStageInfo = ecourtsCodes.stages[caseData.currentStage - 1];
    const questions = stageQuestions[caseData.currentStage] || [];
    const lastHearing = caseData.hearings[caseData.hearings.length - 1];

    res.json({
        cnr: caseData.cnr,
        title: caseData.title,
        nextHearingDate: caseData.nextHearingDate,
        nextHearingPurpose: caseData.nextHearingPurpose,
        currentStage: {
            number: caseData.currentStage,
            name: currentStageInfo?.name,
            whatToExpect: currentStageInfo?.description
        },
        lastHearing: lastHearing ? {
            date: lastHearing.date,
            outcome: lastHearing.businessTranslated,
            classification: lastHearing.classification
        } : null,
        preparationChecklist: [
            "Confirm your lawyer knows about the hearing date",
            `Prepare for: ${caseData.nextHearingPurpose}`,
            "Carry all original documents and previous court orders",
            "Reach court at least 30 minutes before scheduled time",
            ...(lastHearing?.classification === 'adjourned_lawyer' ? ["⚠️ Your lawyer was absent last time. Confirm their availability."] : [])
        ],
        questionsToAsk: questions.slice(0, 3)
    });
});

// ---- Phase CL-3: WhatsApp Alert Link ----
app.get('/api/case/:cnr/whatsapp-alert', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const message = `📢 COURT HEARING ALERT\n\n` +
        `Case: ${caseData.title}\n` +
        `Court: ${caseData.court}\n` +
        `Next Hearing: ${caseData.nextHearingDate}\n` +
        `Purpose: ${caseData.nextHearingPurpose}\n\n` +
        `Stage: ${caseData.currentStage} of ${caseData.totalStages} (${ecourtsCodes.stages[caseData.currentStage - 1]?.name})\n\n` +
        `— Sent via Vakalat`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    res.json({
        cnr: caseData.cnr,
        title: caseData.title,
        nextHearingDate: caseData.nextHearingDate,
        message,
        whatsappUrl
    });
});


// ---- Shorthand: WhatsApp (alias for whatsapp-alert) ----
app.get('/api/case/:cnr/whatsapp', (req, res) => {
    req.params.cnr = req.params.cnr;
    // Reuse the same logic
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const message =
        `⚖️ Vakalat Update\n\n` +
        `*${caseData.title}*\n` +
        `Court: ${caseData.court}\n` +
        `Next Hearing: *${caseData.nextHearingDate || 'Not scheduled'}*\n` +
        `Purpose: ${caseData.nextHearingPurpose || '-'}\n\n` +
        `Stage: ${caseData.currentStage}/8 — ${ecourtsCodes.stages[caseData.currentStage - 1]?.name || ''}\n` +
        `Total Hearings: ${caseData.hearings.length}\n\n` +
        `Tracked via Vakalat`;

    res.json({
        cnr: caseData.cnr,
        title: caseData.title,
        nextHearingDate: caseData.nextHearingDate,
        message,
        whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`
    });
});

// ---- Summary: Single-call compact dashboard data ----
app.get('/api/case/:cnr/summary', (req, res) => {
    const caseData = resolveCase(req.params.cnr);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const hearings = caseData.hearings || [];
    const totalHearings = hearings.length;
    const productive = hearings.filter(h => h.classification === 'productive').length;
    const adjourned = totalHearings - productive;
    const adjournmentRate = totalHearings > 0 ? Math.round((adjourned / totalHearings) * 100) : 0;

    const stageInfo = ecourtsCodes.stages[caseData.currentStage - 1] || {};
    const questions = stageQuestions[caseData.currentStage] || [];

    res.json({
        cnr: caseData.cnr,
        title: caseData.title,
        court: caseData.court,
        state: caseData.state,
        district: caseData.district,
        caseType: caseData.caseType,
        filedDate: caseData.filedDate || caseData['Filing Date'],
        registrationDate: caseData.registrationDate,
        petitioner: caseData.petitioner,
        petitionerAdvocate: caseData.petitionerAdvocate,
        respondent: caseData.respondent,
        respondentAdvocate: caseData.respondentAdvocate,
        acts: caseData.acts || [],
        currentStage: caseData.currentStage,
        totalStages: 8,
        stageName: stageInfo.name || '',
        stageDescription: stageInfo.description || '',
        nextHearingDate: caseData.nextHearingDate,
        nextHearingPurpose: caseData.nextHearingPurpose,
        hearingStats: { totalHearings, productive, adjourned, adjournmentRate: `${adjournmentRate}%` },
        estimatedCostWasted: `₹${(adjourned * 3500).toLocaleString('en-IN')}`,
        topQuestions: questions.slice(0, 3),
        recentHearings: hearings.slice(0, 5),
        source: caseData.source || 'demo',
        cachedAt: caseData.cachedAt
    });
});

// --------------- Start Server ---------------
app.listen(PORT, () => {
    console.log(`\n⚖️  Vakalat Backend running at http://localhost:${PORT}`);
    console.log(`📋 Test page: http://localhost:${PORT}/`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
    console.log(`📚 Demo cases: http://localhost:${PORT}/api/demo-cases\n`);
});
