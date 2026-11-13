import { fmt } from '../../utils';

export default function CaseDetails({ d }) {
    const rows = [
        ['Case type', d.caseType],
        ['Registered', fmt(d.registrationDate)],
        ['First hearing', fmt(d.firstHearingDate)],
        ["Petitioner's advocate", d.petitionerAdvocate],
        ["Respondent's advocate", d.respondentAdvocate],
        ['Case status', d.caseStatus],
    ];
    return (
        <section className="panel" data-reveal aria-labelledby="details-title">
            <div className="panel-head dark"><h2 id="details-title" className="panel-title">Case details</h2></div>
            <dl className="panel-body" style={{ paddingTop: 12, paddingBottom: 12 }}>
                {rows.map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--ink-08)', gap: 16 }}>
                        <dt className="eyebrow" style={{ flexShrink: 0 }}>{label}</dt>
                        <dd className="mono" style={{ fontSize: '0.8rem', color: 'var(--ink-70)', textAlign: 'right' }}>{val || '—'}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
