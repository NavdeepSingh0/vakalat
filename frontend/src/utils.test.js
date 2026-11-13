import { describe, expect, it } from 'vitest';
import { CNR_RE, formatAge, fmt, hearingStatus, isCriminalCaseType, monthsBetween, normalizeCaseData, parseIndianDate, speedyTrial } from './utils';

describe('parseIndianDate', () => {
    it.each([
        ['2025-04-14', '2025-04-14'],
        ['14-04-2025', '2025-04-14'],
        ['14/04/2025', '2025-04-14'],
        ['4.4.2025', '2025-04-04'],
        ['22nd August 2016', '2016-08-22'],
        ['1st January 2020', '2020-01-01'],
        ['14-Apr-2025', '2025-04-14'],
    ])('%s → %s', (input, expected) => expect(parseIndianDate(input)).toBe(expected));

    it('returns an empty string for non-dates', () => {
        for (const v of ['', '-', '—', null, undefined, 'Adjourned']) expect(parseIndianDate(v)).toBe('');
    });
});

describe('fmt', () => {
    it('formats ISO dates without shifting the day (UTC)', () => {
        expect(fmt('2025-04-14')).toMatch(/14/);
        expect(fmt('2025-01-01')).toMatch(/01/);
    });
    it('shows a dash for bad input', () => {
        expect(fmt('')).toBe('—');
        expect(fmt('nonsense')).toBe('—');
    });
});

describe('months and age', () => {
    it('monthsBetween floors and never goes negative', () => {
        expect(monthsBetween('2020-01-01', '2023-01-01')).toBe(36);
        expect(monthsBetween('2023-01-01', '2020-01-01')).toBe(0);
        expect(monthsBetween('bad', '2020-01-01')).toBe(0);
    });
    it('formatAge uses months below a year', () => {
        expect(formatAge(7)).toBe('7 months');
        expect(formatAge(12)).toBe('1 year');
        expect(formatAge(27)).toBe('2 years, 3 months');
        expect(formatAge(1)).toBe('1 month');
    });
});

describe('CNR_RE', () => {
    it('accepts 4 letters + 12 digits only', () => {
        expect(CNR_RE.test('MHNA010000012019')).toBe(true);
        expect(CNR_RE.test('MHNA01000001201')).toBe(false);
        expect(CNR_RE.test('MH0A010000012019')).toBe(false);
    });
});

describe('hearingStatus', () => {
    it('maps backend classifications', () => {
        expect(hearingStatus('adjourned_court')).toBe('adjourned');
        expect(hearingStatus('adjourned_lawyer')).toBe('adjourned');
        expect(hearingStatus('productive')).toBe('heard');
        expect(hearingStatus('disposed')).toBe('disposed');
        expect(hearingStatus('unknown')).toBe('unclear');
        expect(hearingStatus(undefined)).toBe('unclear');
    });
});

describe('normalizeCaseData', () => {
    const raw = {
        cnr: 'MHNA010000012019', title: 'A vs B', court: 'Court X', filedDate: '2019-03-12', nextHearingDate: '2026-12-01',
        currentStage: 5, petitioner: 'Priya', respondent: 'Rajesh', petitionerAdvocate: 'Adv. K', respondentAdvocate: 'Adv. D',
        hearingStats: { total: 3 }, isDemo: true,
        hearings: [ // oldest first, as the API returns them
            { id: 1, date: '2020-01-01', business: 'NOTICE', businessTranslated: 'Notice issued.', classification: 'productive' },
            { id: 2, date: '2021-01-01', business: 'ADJ', classification: 'adjourned_court', hasOrder: true },
            { id: 3, date: '2022-01-01', business: 'Appearance', classification: 'unknown' },
        ],
    };
    const n = normalizeCaseData(raw);

    it('keeps parties and advocates in the right fields', () => {
        expect(n.caseDetails.petitioner).toBe('Priya');
        expect(n.caseDetails.petitionerAdvocate).toBe('Adv. K');
        expect(n.caseDetails.respondent).toBe('Rajesh');
        expect(n.caseDetails.respondentAdvocate).toBe('Adv. D');
        expect(n.caseDetails.stageId).toBe(5);
    });
    it('sorts hearings newest-first by date', () => {
        expect(n.hearings.map((h) => h.id)).toEqual([3, 2, 1]);
    });
    it('derives status and descriptions; unknown stays unclear', () => {
        const byId = Object.fromEntries(n.hearings.map((h) => [h.id, h]));
        expect(byId[1].status).toBe('heard');
        expect(byId[1].description).toBe('Notice issued.');
        expect(byId[2].status).toBe('adjourned');
        expect(byId[2].hasOrder).toBe(true);
        expect(byId[3].status).toBe('unclear');
        expect(byId[3].description).toMatch(/present themselves/i);
    });
    it('carries stats and the demo flag', () => {
        expect(n.stats).toEqual({ total: 3 });
        expect(n.isDemo).toBe(true);
    });
    it('copes with an empty payload', () => {
        expect(normalizeCaseData({}).hearings).toEqual([]);
    });
});

describe('speedyTrial', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    it('flags a civil case older than 3 years', () => {
        const r = speedyTrial({ filingDate: '2020-01-01', caseType: 'Civil Suit' }, now);
        expect(r.isCivil).toBe(true);
        expect(r.benchmarkMonths).toBe(36);
        expect(r.excessMonths).toBeGreaterThan(0);
    });
    it('uses 1 year for criminal cases, including real eCourts type names', () => {
        for (const t of ['Criminal Case (Cheating)', 'Crl.M.P.', 'CC - Complaint Case', 'Sessions Case', 'Bail Application']) {
            expect(isCriminalCaseType(t)).toBe(true);
        }
        expect(isCriminalCaseType('OS - Original Suit')).toBe(false);
        expect(speedyTrial({ filingDate: '2025-01-01', caseType: 'Crl.M.P.' }, now).benchmarkMonths).toBe(12);
    });
    it('stays quiet for young, disposed or undated cases', () => {
        expect(speedyTrial({ filingDate: '2026-01-01', caseType: 'OS' }, now)).toBeNull();
        expect(speedyTrial({ filingDate: '2010-01-01', caseType: 'OS', isDisposed: true }, now)).toBeNull();
        expect(speedyTrial({ filingDate: '', caseType: 'OS' }, now)).toBeNull();
    });
});
