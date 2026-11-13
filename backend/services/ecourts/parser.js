/**
 * Turns the HTML returned by the eCourts "search by CNR" call into a structured case object.
 *
 * Invariants of the returned object (relied on by every route):
 *   - all dates are ISO (YYYY-MM-DD) or '' when unknown
 *   - `hearings` are sorted OLDEST FIRST and get ids 1..n in that order
 *   - order-PDF references stay server-side in `hearing.orderRef`; routes expose `hasOrder` only
 */
const cheerio = require('cheerio');
const ecourtsCodes = require('../../data/ecourts-codes.json');
const { toISODate } = require('./dates');
const { classifyHearing, stageFromText, assignHearingStages } = require('./classifier');

// State letters at the start of a CNR (first two characters).
const STATE_CODES = {
    AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam',
    BR: 'Bihar', CH: 'Chandigarh', CG: 'Chhattisgarh', DN: 'Dadra and Nagar Haveli and Daman and Diu',
    DD: 'Dadra and Nagar Haveli and Daman and Diu', DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat',
    HR: 'Haryana', HP: 'Himachal Pradesh', JK: 'Jammu and Kashmir', JH: 'Jharkhand', KA: 'Karnataka',
    KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MP: 'Madhya Pradesh', MH: 'Maharashtra',
    MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OR: 'Odisha', OD: 'Odisha',
    PY: 'Puducherry', PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana',
    TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', WB: 'West Bengal',
};

const IGNORED_TABLE_CLASSES = ['history_table', 'order_table', 'transfer_table', 'acts_table', 'FIR_details_table'];

const clean = (s) => String(s || '').replace(/[\xa0]/g, ' ').replace(/\s+/g, ' ').trim();

function stateFromCnr(cnr) {
    const code = String(cnr || '').slice(0, 2).toUpperCase();
    return STATE_CODES[code] || '';
}

/** Parses displayPdf('normal_v','case_val','court_code','filename','appFlag') out of an onclick attribute. */
function parseDisplayPdf(onclick) {
    const m = String(onclick || '').match(/displayPdf\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/);
    if (!m || !m[4]) return null;
    return { normalV: m[1], caseVal: m[2], courtCode: m[3], filename: m[4] };
}

function parseParty(listEl) {
    if (!listEl.length) return { name: '', advocate: '' };
    const text = listEl.text().replace(/[\xa0]/g, ' ');
    const party = text.match(/\d+\)\s*([^\n]+?)(?:\s*Advocate|\n|$)/i);
    const advocate = text.match(/Advocate-?\s*([^\n]+)/i);
    return { name: clean(party && party[1]), advocate: clean(advocate && advocate[1]) };
}

function findTitle($) {
    // Only look at heading-like elements, one line each — never regex over the whole page.
    const candidates = $('h1, h2, h3, h4, caption, .case_title, .case-title');
    const re = /^(.{2,120}?)\s+(?:vs\.?|v\/s|versus)\s+(.{2,120})$/i;
    for (const el of candidates.toArray()) {
        const text = clean($(el).text());
        const m = text.match(re);
        if (m) return { title: text, petitioner: clean(m[1]), respondent: clean(m[2]) };
    }
    return null;
}

/**
 * @param {string} html
 * @param {string} cnr
 * @param {'district'|'highcourt'} courtType
 */
function parseCaseHTML(html, cnr, courtType = 'district') {
    const $ = cheerio.load(html);
    const f = {
        caseType: '', filedDate: '', registrationDate: '', firstHearingDate: '', nextHearingDate: '',
        decisionDate: '', caseStage: '', caseStatus: '', court: '', district: '',
    };

    const assign = (rawLabel, rawValue) => {
        const label = clean(rawLabel).toLowerCase().replace(/:/g, '').trim();
        const value = clean(rawValue);
        if (!label || !value || value === '-') return;
        const set = (key, v = value) => { if (!f[key]) f[key] = v; };

        if (label.includes('case type')) set('caseType');
        else if (label.includes('filing date') || label.includes('date of filing')) set('filedDate', toISODate(value) || '');
        else if (label.includes('registration date') || label.includes('date of registration')) set('registrationDate', toISODate(value) || '');
        else if (label.includes('first hearing')) set('firstHearingDate', toISODate(value) || '');
        else if (label.includes('next hearing') || label.includes('next date')) set('nextHearingDate', toISODate(value) || '');
        else if (label.includes('decision date') || label.includes('date of decision')) set('decisionDate', toISODate(value) || '');
        else if (label.includes('case stage')) set('caseStage');
        else if (label.includes('case status') || label === 'status') set('caseStatus');
        else if ((label.includes('court') && label.includes('number') && !label.includes('cnr')) || label.includes('court number and judge')) set('court');
        else if (label.includes('district') && !label.includes('court')) set('district');
    };

    // ── Label/value tables (th td [th td]) ──────────────────────────────────────────────────────
    $('table').each((_, table) => {
        const cls = $(table).attr('class') || '';
        if (IGNORED_TABLE_CLASSES.some((c) => cls.includes(c))) return;
        $(table).find('tr').each((__, tr) => {
            const cells = $(tr).find('td, th').toArray();
            for (let i = 0; i + 1 < cells.length; i += 2) {
                if (cells[i].name !== 'th' && cells.length > 2) continue; // 4-cell rows pair th→td
                assign($(cells[i]).text(), $(cells[i + 1]).text());
            }
        });
    });

    // ── Parties ─────────────────────────────────────────────────────────────────────────────────
    const pet = parseParty($('.Petitioner_Advocate_table, .petitioner-advocate-list').first());
    const resp = parseParty($('.Respondent_Advocate_table, .respondent-advocate-list').first());

    let title = '';
    let petitioner = pet.name;
    let respondent = resp.name;
    const headingTitle = findTitle($);
    if (headingTitle) {
        title = headingTitle.title;
        petitioner = petitioner || headingTitle.petitioner;
        respondent = respondent || headingTitle.respondent;
    }
    if (!title && petitioner && respondent) title = `${petitioner} Vs ${respondent}`;

    // ── Hearing history ─────────────────────────────────────────────────────────────────────────
    const hearings = [];
    const historyTable = $('.history_table').first();
    if (historyTable.length) {
        let rows = historyTable.find('tbody tr');
        if (!rows.length) rows = historyTable.find('tr').slice(1);
        rows.each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length < 4) return;
            const judge = clean($(cells[0]).text());
            const businessDate = toISODate($(cells[1]).text()) || '';
            const date = toISODate($(cells[2]).text()) || businessDate;
            const purpose = clean($(cells[3]).text());
            if (!date && !businessDate && !purpose) return;

            const { classification, faultParty } = classifyHearing(purpose);
            const code = ecourtsCodes.businessCodes[purpose.toUpperCase()];
            hearings.push({
                judge, businessDate, date, purpose,
                business: purpose,
                businessTranslated: (code && code.plain) || purpose,
                classification, faultParty,
                orderRef: null,
            });
        });
    }
    hearings.sort((a, b) => (a.date || '').localeCompare(b.date || '')); // stable → oldest first

    // ── Orders → hearings ───────────────────────────────────────────────────────────────────────
    const orders = [];
    const orderTable = $('.order_table').first();
    if (orderTable.length) {
        let rows = orderTable.find('tbody tr');
        if (!rows.length) rows = orderTable.find('tr').slice(1);
        rows.each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length < 2) return;
            const number = Number.parseInt(clean($(cells[0]).text()), 10) || orders.length + 1;
            const date = toISODate($(cells[1]).text()) || '';
            let ref = null;
            let details = '';
            $(tr).find('a').each((__, a) => {
                ref = ref || parseDisplayPdf($(a).attr('onclick'));
                details = details || clean($(a).text());
            });
            orders.push({ number, date, details: details || 'Copy of order', hasPdf: Boolean(ref), _ref: ref });
        });
    }
    for (const order of orders) {
        if (!order._ref || !order.date) continue;
        const match = hearings.find((h) => !h.orderRef && (h.businessDate === order.date || h.date === order.date));
        if (match) match.orderRef = order._ref;
    }
    hearings.forEach((h, i) => { h.id = i + 1; });

    // ── Acts / transfers ────────────────────────────────────────────────────────────────────────
    const acts = [];
    $('#act_table tr, .acts_table tr').slice(1).each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length >= 2) acts.push({ act: clean($(cells[0]).text()), section: clean($(cells[1]).text()) });
    });
    const transfers = [];
    $('.transfer_table tr').slice(1).each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length >= 4) {
            transfers.push({
                regNumber: clean($(cells[0]).text()), date: toISODate($(cells[1]).text()) || '',
                fromCourt: clean($(cells[2]).text()), toCourt: clean($(cells[3]).text()),
            });
        }
    });

    // ── Stage ───────────────────────────────────────────────────────────────────────────────────
    const isDisposed = /\b(disposed|decided)\b/i.test(f.caseStatus) || Boolean(f.decisionDate);
    const lastHearing = hearings[hearings.length - 1];
    const explicit = stageFromText(f.caseStage);
    const fromHearing = lastHearing ? stageFromText(lastHearing.purpose) : null;
    let currentStage = 1;
    let currentStageCode = 'FIL';
    if (isDisposed) { currentStage = 8; currentStageCode = 'JUD'; }
    else if (explicit) { currentStage = explicit.stage; currentStageCode = explicit.code; }
    else if (fromHearing) { currentStage = fromHearing.stage; currentStageCode = fromHearing.code; }
    assignHearingStages(hearings, currentStage);

    // Purpose of the next hearing: the history row that carries the next date, else the stage text.
    const nextRow = f.nextHearingDate ? hearings.find((h) => h.date === f.nextHearingDate) : null;
    const nextHearingPurpose = (nextRow && nextRow.purpose) || f.caseStage || '';

    const stateName = stateFromCnr(cnr);
    return {
        cnr: String(cnr).toUpperCase(),
        title: title || `Case ${String(cnr).toUpperCase()}`,
        caseType: f.caseType || 'Unknown',
        court: f.court || (courtType === 'highcourt' ? 'High Court' : 'District Court'),
        courtType,
        state: stateName,
        district: f.district || '',
        filedDate: f.filedDate,
        registrationDate: f.registrationDate,
        firstHearingDate: f.firstHearingDate,
        decisionDate: f.decisionDate,
        caseStatus: f.caseStatus,
        caseStageExplicit: f.caseStage,
        isDisposed,
        currentStageCode, currentStage, totalStages: 8,
        nextHearingDate: f.nextHearingDate,
        nextHearingPurpose,
        petitioner: petitioner || 'Unknown',
        petitionerAdvocate: pet.advocate || 'Unknown',
        respondent: respondent || 'Unknown',
        respondentAdvocate: resp.advocate || 'Unknown',
        acts, firDetails: null, hearings,
        orders: orders.map(({ _ref, ...o }) => o),
        transfers,
        source: `ecourts_live_${courtType}`,
        cachedAt: new Date().toISOString(),
    };
}

module.exports = { parseCaseHTML, stateFromCnr, parseDisplayPdf, STATE_CODES };
