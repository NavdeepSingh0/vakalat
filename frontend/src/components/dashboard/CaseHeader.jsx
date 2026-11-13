import { fmt } from '../../utils';

export default function CaseHeader({ d }) {
    const meta = [
        ['Case type', d.caseType || '—', false],
        ['Filed', fmt(d.filingDate), false],
        [d.isDisposed ? 'Status' : 'Next hearing', d.isDisposed ? 'Disposed' : fmt(d.nextHearingDate), !d.isDisposed],
        ['Advocates', `${d.petitionerAdvocate || '—'} / ${d.respondentAdvocate || '—'}`, false],
    ];
    return (
        <header className="case-header dark">
            <div className="container">
                <div className="case-header-top">
                    <div>
                        <p className="mono eyebrow" style={{ color: 'var(--ink-50)', letterSpacing: '0.12em' }}>CNR — {d.cnr}</p>
                        <h1 className="serif" style={{ fontWeight: 700, color: '#fff', fontSize: 'clamp(1.4rem,2.2vw,2rem)', marginTop: 8, lineHeight: 1.15 }}>
                            {d.petitioner || 'Petitioner'}
                            <span style={{ display: 'block', fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-30)', fontSize: '0.875rem', margin: '4px 0' }}>vs</span>
                            {d.respondent || 'Respondent'}
                        </h1>
                    </div>
                    <div className="case-court" style={{ textAlign: 'right' }}>
                        <p className="eyebrow" style={{ color: 'var(--ink-50)', marginBottom: 8 }}>Court</p>
                        <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', lineHeight: 1.4, maxWidth: 280 }}>{d.courtName || '—'}</p>
                        {d.state && <p className="mono" style={{ color: 'var(--ink-30)', fontSize: '0.8rem', marginTop: 6 }}>{d.state}</p>}
                    </div>
                </div>
                <dl className="case-header-meta">
                    {meta.map(([label, val, pulsing]) => (
                        <div key={label}>
                            <dt className="eyebrow" style={{ color: 'var(--ink-50)', marginBottom: 4 }}>{label}</dt>
                            <dd className={`mono ${pulsing ? 'pulse' : ''}`} style={{ fontWeight: pulsing ? 600 : 500, color: '#fff', fontSize: pulsing ? '1rem' : '0.9rem' }}>{val}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </header>
    );
}
