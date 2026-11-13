const { hearingStats } = require('./hearings');

/**
 * What the API returns for a case. Internal order references (`orderRef`) never leave the server —
 * the client only learns `hasOrder`.
 */
function toPublicCase(caseData) {
    const { hearings = [], ...rest } = caseData;
    return {
        ...rest,
        isDemo: caseData.source === 'demo',
        hearings: hearings.map(({ orderRef, ...h }) => ({ ...h, hasOrder: Boolean(orderRef) })),
        hearingStats: hearingStats(hearings),
    };
}

module.exports = { toPublicCase };
