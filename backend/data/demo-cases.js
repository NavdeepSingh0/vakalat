/**
 * Demo seed data — 5 pre-seeded cases for zero-risk hackathon demos.
 * These bypass the CAPTCHA flow entirely (served from memory/Firestore).
 */

const demoCases = [
    {
        cnr: "MHNA010000012019",
        title: "Priya Sharma vs. Rajesh Sharma",
        caseType: "Civil Suit (Property Dispute)",
        court: "Civil Judge Senior Division, Nagpur",
        state: "Maharashtra",
        district: "Nagpur",
        filedDate: "2019-03-12",
        registrationDate: "2019-03-18",
        currentStageCode: "PE",
        currentStage: 5,
        totalStages: 8,
        nextHearingDate: "2025-04-14",
        nextHearingPurpose: "For Plaintiff's Evidence — witness examination",
        petitioner: "Priya Sharma (D/o Late Mohan Sharma)",
        petitionerAdvocate: "Adv. A. Kumar",
        respondent: "Rajesh Sharma (Brother of Petitioner)",
        respondentAdvocate: "Adv. S. Deshmukh",
        hearings: [
            { id: 1, date: "2019-06-15", judge: "Shri R.K. Patil", business: "NOTICE", businessTranslated: "Notice issued to opposite party to appear and respond.", classification: "productive", orderPdfUrl: null },
            { id: 2, date: "2019-09-20", judge: "Shri R.K. Patil", business: "ADJ", businessTranslated: "Adjourned — opposite party counsel absent.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 3, date: "2019-12-14", judge: "Shri R.K. Patil", business: "ADJ", businessTranslated: "Adjourned — judge on leave.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 4, date: "2020-03-10", judge: "Shri R.K. Patil", business: "WS", businessTranslated: "Written statement filed by respondent.", classification: "productive", orderPdfUrl: "/demo/orders/MHNA010000012019_4.pdf" },
            { id: 5, date: "2020-06-15", judge: "Shri R.K. Patil", business: "ADJ", businessTranslated: "Adjourned — COVID-19 lockdown.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 6, date: "2020-11-22", judge: "Shri R.K. Patil", business: "ADJ", businessTranslated: "Adjourned — COVID restrictions, limited court functioning.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 7, date: "2021-03-05", judge: "Smt. M.S. Joshi", business: "FRA", businessTranslated: "Issues framed by the court.", classification: "productive", orderPdfUrl: "/demo/orders/MHNA010000012019_7.pdf" },
            { id: 8, date: "2021-07-18", judge: "Smt. M.S. Joshi", business: "ADJ", businessTranslated: "Adjourned — plaintiff's advocate absent.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 9, date: "2021-11-12", judge: "Smt. M.S. Joshi", business: "ADJ", businessTranslated: "Adjourned — advocate requested more time for evidence preparation.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 10, date: "2022-03-22", judge: "Smt. M.S. Joshi", business: "FOR EVIDENCE", businessTranslated: "Documents submitted as evidence.", classification: "productive", orderPdfUrl: "/demo/orders/MHNA010000012019_10.pdf" },
            { id: 11, date: "2022-08-14", judge: "Smt. M.S. Joshi", business: "ADJ", businessTranslated: "Adjourned — witness not available.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 12, date: "2023-01-20", judge: "Smt. M.S. Joshi", business: "ADJ", businessTranslated: "Adjourned — court busy with older cases.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 13, date: "2024-05-10", judge: "Shri P.V. Rao", business: "NNFR", businessTranslated: "Case was called but not heard today.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 14, date: "2025-02-03", judge: "Shri P.V. Rao", business: "NNFR", businessTranslated: "Case was called but not heard — opposite party counsel absent.", classification: "adjourned_other", orderPdfUrl: null }
        ],
        cachedAt: new Date().toISOString()
    },
    {
        cnr: "UPLU020000052020",
        title: "Ramesh Yadav vs. Suresh Yadav",
        caseType: "Civil Suit (Land Boundary Dispute)",
        court: "Civil Judge Junior Division, Lucknow",
        state: "Uttar Pradesh",
        district: "Lucknow",
        filedDate: "2020-01-08",
        registrationDate: "2020-01-15",
        currentStageCode: "WS",
        currentStage: 3,
        totalStages: 8,
        nextHearingDate: "2025-05-02",
        nextHearingPurpose: "For filing Written Statement by Defendant",
        petitioner: "Ramesh Yadav (Farmer)",
        petitionerAdvocate: "Adv. D. Mishra",
        respondent: "Suresh Yadav (Neighbour)",
        respondentAdvocate: "Adv. R. Tiwari",
        hearings: [
            { id: 1, date: "2020-04-10", judge: "Shri A.K. Singh", business: "NOTICE", businessTranslated: "Notice issued to respondent.", classification: "productive", orderPdfUrl: null },
            { id: 2, date: "2020-09-15", judge: "Shri A.K. Singh", business: "ADJ", businessTranslated: "Adjourned — COVID restrictions.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 3, date: "2021-02-20", judge: "Shri A.K. Singh", business: "ADJ", businessTranslated: "Adjourned — respondent did not appear.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 4, date: "2021-08-05", judge: "Shri A.K. Singh", business: "ADJ", businessTranslated: "Adjourned — petitioner's advocate absent.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 5, date: "2022-01-18", judge: "Smt. P. Gupta", business: "ADJ", businessTranslated: "Adjourned — judge transferred, new judge assigned.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 6, date: "2022-07-22", judge: "Smt. P. Gupta", business: "ADJ", businessTranslated: "Adjourned — respondent's counsel sought time.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 7, date: "2023-03-11", judge: "Smt. P. Gupta", business: "S/O", businessTranslated: "Standing over — case postponed to later in the session.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 8, date: "2024-06-15", judge: "Smt. P. Gupta", business: "NNFR", businessTranslated: "Not heard — board too heavy.", classification: "adjourned_court", orderPdfUrl: null }
        ],
        cachedAt: new Date().toISOString()
    },
    {
        cnr: "DLND030000032021",
        title: "M/s Quick Solutions Pvt. Ltd. vs. Arjun Enterprises",
        caseType: "Commercial Suit (Recovery of Money)",
        court: "Commercial Court, New Delhi",
        state: "Delhi",
        district: "New Delhi",
        filedDate: "2021-05-20",
        registrationDate: "2021-05-28",
        currentStageCode: "WS",
        currentStage: 3,
        totalStages: 8,
        nextHearingDate: "2025-03-25",
        nextHearingPurpose: "For Written Statement filing by Defendant",
        petitioner: "M/s Quick Solutions Pvt. Ltd.",
        petitionerAdvocate: "Adv. N. Khanna",
        respondent: "Arjun Enterprises",
        respondentAdvocate: "Adv. V. Mehta",
        hearings: [
            { id: 1, date: "2021-08-10", judge: "Shri S.K. Verma", business: "NOTICE", businessTranslated: "Notice issued to defendant company.", classification: "productive", orderPdfUrl: null },
            { id: 2, date: "2021-12-03", judge: "Shri S.K. Verma", business: "ADJ", businessTranslated: "Adjourned — defendant sought time to file written statement.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 3, date: "2022-04-15", judge: "Shri S.K. Verma", business: "ADJ", businessTranslated: "Adjourned — plaintiff's advocate absent.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 4, date: "2022-09-20", judge: "Shri S.K. Verma", business: "ADJ", businessTranslated: "Adjourned — mediation attempted, failed.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 5, date: "2023-03-10", judge: "Smt. R. Kapoor", business: "ADJ", businessTranslated: "Adjourned — judge on leave.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 6, date: "2024-01-15", judge: "Smt. R. Kapoor", business: "NNFR", businessTranslated: "Not heard today — heavy board.", classification: "adjourned_court", orderPdfUrl: null }
        ],
        cachedAt: new Date().toISOString()
    },
    {
        cnr: "TNCH040000082018",
        title: "Lakshmi Ammal vs. Kannan",
        caseType: "Rent Control Petition (Eviction)",
        court: "Small Causes Court, Chennai",
        state: "Tamil Nadu",
        district: "Chennai",
        filedDate: "2018-11-05",
        registrationDate: "2018-11-12",
        currentStageCode: "ARG",
        currentStage: 7,
        totalStages: 8,
        nextHearingDate: "2025-04-28",
        nextHearingPurpose: "For Final Arguments by Respondent",
        petitioner: "Lakshmi Ammal (Elderly Widow, Property Owner)",
        petitionerAdvocate: "Adv. K. Selvam",
        respondent: "Kannan (Tenant)",
        respondentAdvocate: "Adv. M. Rajan",
        hearings: [
            { id: 1, date: "2019-02-10", judge: "Shri T. Murugan", business: "NOTICE", businessTranslated: "Notice issued to tenant.", classification: "productive", orderPdfUrl: null },
            { id: 2, date: "2019-06-20", judge: "Shri T. Murugan", business: "WS", businessTranslated: "Written statement filed by tenant.", classification: "productive", orderPdfUrl: null },
            { id: 3, date: "2019-10-15", judge: "Shri T. Murugan", business: "FRA", businessTranslated: "Issues framed.", classification: "productive", orderPdfUrl: "/demo/orders/TNCH040000082018_3.pdf" },
            { id: 4, date: "2020-02-14", judge: "Shri T. Murugan", business: "ADJ", businessTranslated: "Adjourned — COVID-19.", classification: "adjourned_court", orderPdfUrl: null },
            { id: 5, date: "2020-09-10", judge: "Shri T. Murugan", business: "FOR EVIDENCE", businessTranslated: "Petitioner's evidence recorded.", classification: "productive", orderPdfUrl: null },
            { id: 6, date: "2021-01-22", judge: "Smt. S. Lakshmi", business: "ADJ", businessTranslated: "Adjourned — petitioner's advocate absent.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 7, date: "2021-07-08", judge: "Smt. S. Lakshmi", business: "FOR CROSS EXAMINATION", businessTranslated: "Cross-examination of petitioner's witness.", classification: "productive", orderPdfUrl: null },
            { id: 8, date: "2022-01-15", judge: "Smt. S. Lakshmi", business: "FOR EVIDENCE", businessTranslated: "Respondent's evidence recorded.", classification: "productive", orderPdfUrl: null },
            { id: 9, date: "2022-08-20", judge: "Smt. S. Lakshmi", business: "ADJ", businessTranslated: "Adjourned — respondent's advocate sought time.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 10, date: "2023-02-10", judge: "Smt. S. Lakshmi", business: "FOR ARGUMENTS", businessTranslated: "Petitioner's final arguments heard.", classification: "productive", orderPdfUrl: null },
            { id: 11, date: "2023-09-05", judge: "Smt. S. Lakshmi", business: "PART HEARD", businessTranslated: "Arguments partially heard — will continue next date.", classification: "productive", orderPdfUrl: null },
            { id: 12, date: "2024-11-20", judge: "Shri V. Kumar", business: "ADJ", businessTranslated: "Adjourned — judge transferred.", classification: "adjourned_court", orderPdfUrl: null }
        ],
        cachedAt: new Date().toISOString()
    },
    {
        cnr: "MHPU050000072022",
        title: "Vikram Desai vs. State of Maharashtra",
        caseType: "Criminal Case (Cheating — IPC 420)",
        court: "Judicial Magistrate First Class, Pune",
        state: "Maharashtra",
        district: "Pune",
        filedDate: "2022-08-15",
        registrationDate: "2022-08-22",
        currentStageCode: "PE",
        currentStage: 5,
        totalStages: 8,
        nextHearingDate: "2025-03-20",
        nextHearingPurpose: "For Prosecution Evidence — witness examination",
        petitioner: "State of Maharashtra (Complainant: Vikram Desai)",
        petitionerAdvocate: "APP (Assistant Public Prosecutor)",
        respondent: "Accused: Amit Joshi",
        respondentAdvocate: "Adv. P. Kulkarni",
        hearings: [
            { id: 1, date: "2022-10-10", judge: "Shri J.M. Patel", business: "ADM", businessTranslated: "Cognizance taken. Accused summoned.", classification: "productive", orderPdfUrl: "/demo/orders/MHPU050000072022_1.pdf" },
            { id: 2, date: "2023-01-15", judge: "Shri J.M. Patel", business: "ADJ", businessTranslated: "Adjourned — accused not appeared.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 3, date: "2023-05-20", judge: "Shri J.M. Patel", business: "HEARD", businessTranslated: "Accused appeared. Bail granted. Charges framed.", classification: "productive", orderPdfUrl: "/demo/orders/MHPU050000072022_3.pdf" },
            { id: 4, date: "2023-10-08", judge: "Shri J.M. Patel", business: "ADJ", businessTranslated: "Adjourned — prosecution witness not available.", classification: "adjourned_other", orderPdfUrl: null },
            { id: 5, date: "2024-03-12", judge: "Smt. A.R. Deshpande", business: "ADJ", businessTranslated: "Adjourned — APP absent.", classification: "adjourned_lawyer", orderPdfUrl: null },
            { id: 6, date: "2024-09-18", judge: "Smt. A.R. Deshpande", business: "FOR EVIDENCE", businessTranslated: "First prosecution witness examined.", classification: "productive", orderPdfUrl: null }
        ],
        cachedAt: new Date().toISOString()
    }
];

/**
 * In-memory case store for demo mode (when Firebase is not connected).
 */
class DemoCaseStore {
    constructor() {
        this.cases = new Map();
        demoCases.forEach(c => this.cases.set(c.cnr, c));
    }

    getCase(cnr) {
        return this.cases.get(cnr) || null;
    }

    setCase(cnr, data) {
        this.cases.set(cnr, data);
    }

    searchByPartyName(name) {
        const lower = name.toLowerCase();
        return demoCases.filter(c =>
            c.petitioner.toLowerCase().includes(lower) ||
            c.respondent.toLowerCase().includes(lower) ||
            c.title.toLowerCase().includes(lower)
        );
    }

    searchByAdvocate(name) {
        const lower = name.toLowerCase();
        return demoCases.filter(c =>
            c.petitionerAdvocate.toLowerCase().includes(lower) ||
            c.respondentAdvocate.toLowerCase().includes(lower)
        );
    }

    getAllCases() {
        return demoCases;
    }
}

module.exports = { demoCases, DemoCaseStore };
