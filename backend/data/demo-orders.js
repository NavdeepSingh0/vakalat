/**
 * Sample court orders for the demo cases. They are FICTIONAL and exist only so the
 * "Read this order" feature can be demonstrated offline. Keyed by "<CNR>:<hearingId>".
 * `summary` is a pre-written plain-English summary used when no GEMINI_API_KEY is configured.
 */
const HEADER = (court, cnr, title) => [
    'SAMPLE ORDER (FICTIONAL — FOR DEMONSTRATION ONLY)',
    court.toUpperCase(),
    `CNR: ${cnr}`,
    title,
    '',
];

const o = (court, cnr, title, date, lines, summary) => ({
    text: [...HEADER(court, cnr, title), `ORDER DATED ${date}`, '', ...lines, '', 'Sd/- Presiding Officer'].join('\n'),
    summary: { ...summary, generatedAt: null, sample: true },
});

const DEMO_ORDERS = {
    'MHNA010000012019:4': o('Civil Judge Senior Division, Nagpur', 'MHNA010000012019', 'Priya Sharma vs. Rajesh Sharma', '10-03-2020', [
        'Present: Adv. A. Kumar for the plaintiff; Adv. S. Deshmukh for the defendant.',
        'The defendant has filed the written statement today. A copy has been supplied to the plaintiff.',
        'The plaintiff may file a replication within four weeks.',
        'List the matter on 15-06-2020 for framing of issues.',
    ], {
        summary: 'The defendant (Rajesh Sharma) has now filed his written reply to the case. Priya Sharma gets four weeks to respond to it, and the next date is set for the judge to decide which questions the trial must answer.',
        actions: ['Plaintiff: file a reply (replication) to the written statement within four weeks.', 'Both sides: be ready for the court to frame issues on the next date.'],
        deadlines: ['Replication due within four weeks of 10-03-2020.', 'Next listing: 15-06-2020 for framing of issues.'],
        nextHearingPurpose: 'The court will frame the issues to be decided at trial.',
    }),
    'MHNA010000012019:7': o('Civil Judge Senior Division, Nagpur', 'MHNA010000012019', 'Priya Sharma vs. Rajesh Sharma', '05-03-2021', [
        'Heard both sides on the pleadings.',
        'The following issues are framed: (1) Whether the plaintiff proves she is a co-owner of the suit property? (2) Whether the defendant is in unlawful possession? (3) Relief.',
        'The plaintiff shall lead evidence. Affidavit of evidence to be filed before the next date.',
        'List on 18-07-2021 for plaintiff\'s evidence.',
    ], {
        summary: 'The judge has written down the main questions this case must answer — mainly whether Priya is a co-owner of the property and whether her brother is occupying it unlawfully. Priya now has to present her evidence.',
        actions: ['Plaintiff: file the affidavit of evidence before the next date.', 'Plaintiff: line up witnesses and documents for the evidence stage.'],
        deadlines: ['Affidavit of evidence before 18-07-2021.'],
        nextHearingPurpose: "Plaintiff's evidence begins.",
    }),
    'MHNA010000012019:10': o('Civil Judge Senior Division, Nagpur', 'MHNA010000012019', 'Priya Sharma vs. Rajesh Sharma', '22-03-2022', [
        'Plaintiff tenders documents Ex. P-1 to P-6 (title documents and tax receipts). Marked as exhibits subject to proof.',
        'Examination-in-chief of PW-1 (plaintiff) to be completed on the next date.',
        'List on 14-08-2022.',
    ], {
        summary: 'Priya submitted six documents (ownership papers and tax receipts) and they were officially numbered as exhibits. She still has to give her own testimony on the next date.',
        actions: ['Plaintiff: be present to give testimony as PW-1.', 'Bring originals of the exhibited documents.'],
        deadlines: ['Next date: 14-08-2022.'],
        nextHearingPurpose: 'Plaintiff completes her examination-in-chief.',
    }),
    'TNCH040000082018:3': o('Small Causes Court, Chennai', 'TNCH040000082018', 'Lakshmi Ammal vs. Kannan', '15-10-2019', [
        'Issues framed: (1) Whether the respondent is in arrears of rent? (2) Whether the petitioner needs the premises bona fide?',
        'Petitioner to file proof affidavit within three weeks.',
        'List on 14-02-2020 for petitioner\'s evidence.',
    ], {
        summary: 'The court has listed two questions to decide: whether the tenant owes rent, and whether the landlady genuinely needs the property back. She must file her sworn statement within three weeks.',
        actions: ['Petitioner: file the proof affidavit within three weeks.', 'Keep rent records and proof of need ready.'],
        deadlines: ['Proof affidavit due three weeks from 15-10-2019.', 'Next listing: 14-02-2020.'],
        nextHearingPurpose: "Petitioner's evidence.",
    }),
    'MHPU050000072022:1': o('Judicial Magistrate First Class, Pune', 'MHPU050000072022', 'State of Maharashtra vs. Amit Joshi', '10-10-2022', [
        'Complaint and documents perused. Cognizance of the offence is taken.',
        'Issue summons to the accused returnable on 15-01-2023.',
        'The complainant shall pay process fee within one week.',
    ], {
        summary: 'The magistrate has formally accepted the complaint and ordered the accused to be summoned. The complainant must pay the process fee within a week or the summons may not go out.',
        actions: ['Complainant: pay the process fee within one week.', 'Accused: appear on 15-01-2023.'],
        deadlines: ['Process fee within one week of 10-10-2022.', 'Return date: 15-01-2023.'],
        nextHearingPurpose: 'The accused is expected to appear in court.',
    }),
    'MHPU050000072022:3': o('Judicial Magistrate First Class, Pune', 'MHPU050000072022', 'State of Maharashtra vs. Amit Joshi', '20-05-2023', [
        'Accused appeared through Adv. P. Kulkarni. Bail granted on a personal bond of Rs. 25,000 with one surety.',
        'Charge framed and explained to the accused, who pleads not guilty and claims trial.',
        'List on 08-10-2023 for prosecution evidence.',
    ], {
        summary: 'The accused came to court and was released on bail. The formal charge was read out, he denied it, so the case now goes to trial and the prosecution must bring its witnesses.',
        actions: ['Accused: comply with the bail conditions and attend every date.', 'Prosecution: arrange for witnesses on the next date.'],
        deadlines: ['Next listing: 08-10-2023 for prosecution evidence.'],
        nextHearingPurpose: 'Prosecution begins presenting witnesses.',
    }),
};

module.exports = { DEMO_ORDERS };
