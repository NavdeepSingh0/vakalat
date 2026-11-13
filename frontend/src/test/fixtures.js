// A small public-case payload (as returned by GET /api/case/:cnr) and a fetch mock that serves it.
export const CNR = 'MHNA010000012019';

export const casePayload = {
    cnr: CNR, title: 'Priya Sharma vs. Rajesh Sharma', court: 'Civil Judge Senior Division, Nagpur', state: 'Maharashtra',
    caseType: 'Civil Suit (Property Dispute)', filedDate: '2019-03-12', registrationDate: '2019-03-18', firstHearingDate: '2019-06-15',
    nextHearingDate: '2099-01-10', nextHearingPurpose: "For Plaintiff's Evidence", currentStage: 5, isDisposed: false, isDemo: true,
    petitioner: 'Priya Sharma', respondent: 'Rajesh Sharma', petitionerAdvocate: 'Adv. A. Kumar', respondentAdvocate: 'Adv. S. Deshmukh',
    source: 'demo',
    hearingStats: { total: 3, heard: 1, adjourned: 1, unclear: 1, disposed: 0, unproductive: 2, adjournmentRate: 33, unproductiveRate: 67 },
    hearings: [
        { id: 1, date: '2019-06-15', judge: 'J', business: 'NOTICE', purpose: 'NOTICE', businessTranslated: 'Notice issued to opposite party.', classification: 'productive', hasOrder: false },
        { id: 2, date: '2020-03-10', judge: 'J', business: 'WS', purpose: 'WS', businessTranslated: 'Written statement filed by respondent.', classification: 'productive', hasOrder: true },
        { id: 3, date: '2020-06-15', judge: 'J', business: 'ADJ', purpose: 'ADJ', businessTranslated: 'Adjourned — COVID-19 lockdown.', classification: 'adjourned_court', hasOrder: false },
    ],
};

const stagePayload = {
    currentStage: 5, totalStages: 8, currentStageName: "Plaintiff's Evidence", estimatedMonthsRemaining: 19,
    stages: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ stageNumber: n, name: `Stage ${n}`, description: `About stage ${n}`, avgMonthsDistrict: 3, status: n < 5 ? 'completed' : n === 5 ? 'current' : 'upcoming', isCurrent: n === 5 })),
};

const costOptions = {
    defaults: { seniorFeePerHearing: 32500, juniorCount: 0, travelMode: 'local', workerType: 'salaried_formal' },
    workerTypes: [{ id: 'salaried_formal', label: 'Salaried formal', perDay: 1800 }],
    travelModes: [{ id: 'local', label: 'Local', travel: 500, hotel: 0 }],
    disclaimer: 'Estimate only.',
};

const costResult = {
    totalDrain: 123456, recoverableFromOP: 0, adjournedCount: 1, unclearCount: 1,
    costHeadSummary: { professionalFees: 100000, travelStay: 500, opportunityCost: 20000, incidentals: 2956 },
};

const routes = [
    [/^\/api\/demo-cases$/, () => [{ cnr: CNR, title: casePayload.title }]],
    [/^\/api\/cost-config$/, () => costOptions],
    [/^\/api\/case\/[A-Z0-9]+\/cost$/, () => costResult],
    [/^\/api\/case\/[A-Z0-9]+\/stage$/, () => stagePayload],
    [/^\/api\/case\/[A-Z0-9]+\/questions$/, () => ({ stage: 5, stageName: "Plaintiff's Evidence", questions: [{ q: 'Which witnesses are listed?', why: 'Witness availability causes adjournments.' }], contextualQuestions: [] })],
    [/^\/api\/case\/[A-Z0-9]+\/prep$/, () => ({ nextHearingDate: '2099-01-10', daysUntilNextHearing: 30, currentStage: { number: 5, name: 'PE', whatToExpect: 'Evidence' }, preparationChecklist: ['Carry originals'] })],
    [/^\/api\/case\/[A-Z0-9]+\/whatsapp$/, () => ({ whatsappUrl: 'https://wa.me/?text=hi' })],
    [/^\/api\/case\/[A-Z0-9]+$/, () => casePayload],
    [/^\/api\/order\/[A-Z0-9]+\/\d+\/summary$/, () => ({ success: true, summary: 'Plain summary.', actions: ['Do X'], deadlines: [], nextHearingPurpose: '', sample: true })],
    [/^\/api\/captcha/, () => ({ sessionId: 'sess_1', courtType: 'district', captchaDataUrl: 'data:image/png;base64,AAAA' })],
];

/** Installs a global fetch mock. Returns the list of requested paths for assertions. */
export function mockApi(overrides = {}) {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
        const path = new URL(url, 'http://localhost').pathname + new URL(url, 'http://localhost').search;
        calls.push(`${init.method || 'GET'} ${path}`);
        const pathname = path.split('?')[0];
        for (const [re, handler] of routes) {
            if (re.test(pathname)) {
                const override = overrides[re.source];
                if (override) return override();
                return { ok: true, status: 200, json: async () => handler() };
            }
        }
        return { ok: false, status: 404, json: async () => ({ error: 'not_found', message: 'nope' }) };
    };
    return calls;
}
