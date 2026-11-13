/**
 * Demo cases — five fictional cases that work with zero setup and no CAPTCHA.
 * Everything is invented. Past hearing dates are fixed; `nextHearingDate` is generated
 * relative to "today" so the demo never shows a hearing date in the past.
 *
 * The "own side" in these cases is the petitioner / plaintiff / complainant.
 */
const { addDaysISO } = require('../services/ecourts/dates');
const { assignHearingStages } = require('../services/ecourts/classifier');

// h(id, date, judge, businessCode, plainEnglish, classification, faultParty, hasOrder)
function h(id, date, judge, business, businessTranslated, classification, faultParty = 'unspecified', hasOrder = false) {
    return {
        id, date, businessDate: date, judge, business, purpose: business, businessTranslated,
        classification, faultParty,
        orderRef: hasOrder ? { demo: true } : null,
    };
}

function buildDemoCases(now = new Date()) {
    const cases = [
        {
            cnr: 'MHNA010000012019',
            title: 'Priya Sharma vs. Rajesh Sharma',
            caseType: 'Civil Suit (Property Dispute)',
            court: 'Civil Judge Senior Division, Nagpur',
            state: 'Maharashtra', district: 'Nagpur',
            filedDate: '2019-03-12', registrationDate: '2019-03-18', firstHearingDate: '2019-06-15',
            currentStageCode: 'PE', currentStage: 5,
            nextHearingDate: addDaysISO(12, now),
            nextHearingPurpose: "For Plaintiff's Evidence — witness examination",
            petitioner: 'Priya Sharma (D/o Late Mohan Sharma)', petitionerAdvocate: 'Adv. A. Kumar',
            respondent: 'Rajesh Sharma (Brother of Petitioner)', respondentAdvocate: 'Adv. S. Deshmukh',
            hearings: [
                h(1, '2019-06-15', 'Shri R.K. Patil', 'NOTICE', 'Notice issued to opposite party to appear and respond.', 'productive'),
                h(2, '2019-09-20', 'Shri R.K. Patil', 'ADJ', 'Adjourned — opposite party counsel absent.', 'adjourned_lawyer', 'opposite_party'),
                h(3, '2019-12-14', 'Shri R.K. Patil', 'ADJ', 'Adjourned — judge on leave.', 'adjourned_court', 'court_system'),
                h(4, '2020-03-10', 'Shri R.K. Patil', 'WS', 'Written statement filed by respondent.', 'productive', 'unspecified', true),
                h(5, '2020-06-15', 'Shri R.K. Patil', 'ADJ', 'Adjourned — COVID-19 lockdown.', 'adjourned_court', 'court_system'),
                h(6, '2020-11-22', 'Shri R.K. Patil', 'ADJ', 'Adjourned — COVID restrictions, limited court functioning.', 'adjourned_court', 'court_system'),
                h(7, '2021-03-05', 'Smt. M.S. Joshi', 'FRA', 'Issues framed by the court.', 'productive', 'unspecified', true),
                h(8, '2021-07-18', 'Smt. M.S. Joshi', 'ADJ', "Adjourned — plaintiff's advocate absent.", 'adjourned_lawyer', 'own_side'),
                h(9, '2021-11-12', 'Smt. M.S. Joshi', 'ADJ', 'Adjourned — advocate requested more time for evidence preparation.', 'adjourned_lawyer', 'own_side'),
                h(10, '2022-03-22', 'Smt. M.S. Joshi', 'FOR EVIDENCE', 'Documents submitted as evidence.', 'productive', 'unspecified', true),
                h(11, '2022-08-14', 'Smt. M.S. Joshi', 'ADJ', 'Adjourned — witness not available.', 'adjourned_other'),
                h(12, '2023-01-20', 'Smt. M.S. Joshi', 'ADJ', 'Adjourned — court busy with older cases.', 'adjourned_court', 'court_system'),
                h(13, '2024-05-10', 'Shri P.V. Rao', 'NNFR', 'Case was called but not heard today.', 'adjourned_court', 'court_system'),
                h(14, '2025-02-03', 'Shri P.V. Rao', 'NNFR', 'Case was called but not heard — opposite party counsel absent.', 'adjourned_other', 'opposite_party'),
            ],
        },
        {
            cnr: 'UPLU020000052020',
            title: 'Ramesh Yadav vs. Suresh Yadav',
            caseType: 'Civil Suit (Land Boundary Dispute)',
            court: 'Civil Judge Junior Division, Lucknow',
            state: 'Uttar Pradesh', district: 'Lucknow',
            filedDate: '2020-01-08', registrationDate: '2020-01-15', firstHearingDate: '2020-04-10',
            currentStageCode: 'WS', currentStage: 3,
            nextHearingDate: addDaysISO(27, now),
            nextHearingPurpose: 'For filing Written Statement by Defendant',
            petitioner: 'Ramesh Yadav (Farmer)', petitionerAdvocate: 'Adv. D. Mishra',
            respondent: 'Suresh Yadav (Neighbour)', respondentAdvocate: 'Adv. R. Tiwari',
            hearings: [
                h(1, '2020-04-10', 'Shri A.K. Singh', 'NOTICE', 'Notice issued to respondent.', 'productive'),
                h(2, '2020-09-15', 'Shri A.K. Singh', 'ADJ', 'Adjourned — COVID restrictions.', 'adjourned_court', 'court_system'),
                h(3, '2021-02-20', 'Shri A.K. Singh', 'ADJ', 'Adjourned — respondent did not appear.', 'adjourned_other', 'opposite_party'),
                h(4, '2021-08-05', 'Shri A.K. Singh', 'ADJ', "Adjourned — petitioner's advocate absent.", 'adjourned_lawyer', 'own_side'),
                h(5, '2022-01-18', 'Smt. P. Gupta', 'ADJ', 'Adjourned — judge transferred, new judge assigned.', 'adjourned_court', 'court_system'),
                h(6, '2022-07-22', 'Smt. P. Gupta', 'ADJ', "Adjourned — respondent's counsel sought time.", 'adjourned_lawyer', 'opposite_party'),
                h(7, '2023-03-11', 'Smt. P. Gupta', 'S/O', 'Standing over — case postponed to later in the session.', 'adjourned_court', 'court_system'),
                h(8, '2024-06-15', 'Smt. P. Gupta', 'NNFR', 'Not heard — board too heavy.', 'adjourned_court', 'court_system'),
            ],
        },
        {
            cnr: 'DLND030000032021',
            title: 'M/s Quick Solutions Pvt. Ltd. vs. Arjun Enterprises',
            caseType: 'Commercial Suit (Recovery of Money)',
            court: 'Commercial Court, New Delhi',
            state: 'Delhi', district: 'New Delhi',
            filedDate: '2021-05-20', registrationDate: '2021-05-28', firstHearingDate: '2021-08-10',
            currentStageCode: 'WS', currentStage: 3,
            nextHearingDate: addDaysISO(9, now),
            nextHearingPurpose: 'For Written Statement filing by Defendant',
            petitioner: 'M/s Quick Solutions Pvt. Ltd.', petitionerAdvocate: 'Adv. N. Khanna',
            respondent: 'Arjun Enterprises', respondentAdvocate: 'Adv. V. Mehta',
            hearings: [
                h(1, '2021-08-10', 'Shri S.K. Verma', 'NOTICE', 'Notice issued to defendant company.', 'productive'),
                h(2, '2021-12-03', 'Shri S.K. Verma', 'ADJ', 'Adjourned — defendant sought time to file written statement.', 'adjourned_other', 'opposite_party'),
                h(3, '2022-04-15', 'Shri S.K. Verma', 'ADJ', "Adjourned — plaintiff's advocate absent.", 'adjourned_lawyer', 'own_side'),
                h(4, '2022-09-20', 'Shri S.K. Verma', 'ADJ', 'Adjourned — mediation attempted, failed.', 'adjourned_other'),
                h(5, '2023-03-10', 'Smt. R. Kapoor', 'ADJ', 'Adjourned — judge on leave.', 'adjourned_court', 'court_system'),
                h(6, '2024-01-15', 'Smt. R. Kapoor', 'NNFR', 'Not heard today — heavy board.', 'adjourned_court', 'court_system'),
            ],
        },
        {
            cnr: 'TNCH040000082018',
            title: 'Lakshmi Ammal vs. Kannan',
            caseType: 'Rent Control Petition (Eviction)',
            court: 'Small Causes Court, Chennai',
            state: 'Tamil Nadu', district: 'Chennai',
            filedDate: '2018-11-05', registrationDate: '2018-11-12', firstHearingDate: '2019-02-10',
            currentStageCode: 'ARG', currentStage: 7,
            nextHearingDate: addDaysISO(40, now),
            nextHearingPurpose: 'For Final Arguments by Respondent',
            petitioner: 'Lakshmi Ammal (Elderly Widow, Property Owner)', petitionerAdvocate: 'Adv. K. Selvam',
            respondent: 'Kannan (Tenant)', respondentAdvocate: 'Adv. M. Rajan',
            hearings: [
                h(1, '2019-02-10', 'Shri T. Murugan', 'NOTICE', 'Notice issued to tenant.', 'productive'),
                h(2, '2019-06-20', 'Shri T. Murugan', 'WS', 'Written statement filed by tenant.', 'productive'),
                h(3, '2019-10-15', 'Shri T. Murugan', 'FRA', 'Issues framed.', 'productive', 'unspecified', true),
                h(4, '2020-02-14', 'Shri T. Murugan', 'ADJ', 'Adjourned — COVID-19.', 'adjourned_court', 'court_system'),
                h(5, '2020-09-10', 'Shri T. Murugan', 'FOR EVIDENCE', "Petitioner's evidence recorded.", 'productive'),
                h(6, '2021-01-22', 'Smt. S. Lakshmi', 'ADJ', "Adjourned — petitioner's advocate absent.", 'adjourned_lawyer', 'own_side'),
                h(7, '2021-07-08', 'Smt. S. Lakshmi', 'FOR CROSS EXAMINATION', "Cross-examination of petitioner's witness.", 'productive'),
                h(8, '2022-01-15', 'Smt. S. Lakshmi', 'FOR EVIDENCE', "Respondent's evidence recorded.", 'productive'),
                h(9, '2022-08-20', 'Smt. S. Lakshmi', 'ADJ', "Adjourned — respondent's advocate sought time.", 'adjourned_lawyer', 'opposite_party'),
                h(10, '2023-02-10', 'Smt. S. Lakshmi', 'FOR ARGUMENTS', "Petitioner's final arguments heard.", 'productive'),
                h(11, '2023-09-05', 'Smt. S. Lakshmi', 'PART HEARD', 'Arguments partially heard — will continue next date.', 'productive'),
                h(12, '2024-11-20', 'Shri V. Kumar', 'ADJ', 'Adjourned — judge transferred.', 'adjourned_court', 'court_system'),
            ],
        },
        {
            cnr: 'MHPU050000072022',
            title: 'Vikram Desai vs. State of Maharashtra',
            caseType: 'Criminal Case (Cheating — IPC 420)',
            court: 'Judicial Magistrate First Class, Pune',
            state: 'Maharashtra', district: 'Pune',
            filedDate: '2022-08-15', registrationDate: '2022-08-22', firstHearingDate: '2022-10-10',
            currentStageCode: 'PE', currentStage: 5,
            nextHearingDate: addDaysISO(21, now),
            nextHearingPurpose: 'For Prosecution Evidence — witness examination',
            petitioner: 'State of Maharashtra (Complainant: Vikram Desai)', petitionerAdvocate: 'APP (Assistant Public Prosecutor)',
            respondent: 'Accused: Amit Joshi', respondentAdvocate: 'Adv. P. Kulkarni',
            hearings: [
                h(1, '2022-10-10', 'Shri J.M. Patel', 'ADM', 'Cognizance taken. Accused summoned.', 'productive', 'unspecified', true),
                h(2, '2023-01-15', 'Shri J.M. Patel', 'ADJ', 'Adjourned — accused not appeared.', 'adjourned_other', 'opposite_party'),
                h(3, '2023-05-20', 'Shri J.M. Patel', 'HEARD', 'Accused appeared. Bail granted. Charges framed.', 'productive', 'unspecified', true),
                h(4, '2023-10-08', 'Shri J.M. Patel', 'ADJ', 'Adjourned — prosecution witness not available.', 'adjourned_other'),
                h(5, '2024-03-12', 'Smt. A.R. Deshpande', 'ADJ', 'Adjourned — APP absent.', 'adjourned_lawyer', 'own_side'),
                h(6, '2024-09-18', 'Smt. A.R. Deshpande', 'FOR EVIDENCE', 'First prosecution witness examined.', 'productive'),
            ],
        },
    ];

    const stamp = now.toISOString();
    for (const c of cases) {
        assignHearingStages(c.hearings, c.currentStage);
        c.totalStages = 8;
        c.courtType = 'district';
        c.isDisposed = false;
        c.decisionDate = '';
        c.acts = [];
        c.orders = [];
        c.transfers = [];
        c.source = 'demo';
        c.cachedAt = stamp;
    }
    return cases;
}

module.exports = { buildDemoCases };
