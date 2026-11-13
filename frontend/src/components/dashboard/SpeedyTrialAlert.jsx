import { formatAge } from '../../utils';

/** Shown when a pending case is older than Vakalat's reference timeline (civil 3 yrs, criminal 1 yr). */
export default function SpeedyTrialAlert({ info }) {
    if (!info) return null;
    return (
        <section className="alert-speedy dark container" data-reveal aria-labelledby="speedy-title" style={{ marginTop: 0 }}>
            <div style={{ fontSize: '1.8rem', lineHeight: 1, flexShrink: 0 }} aria-hidden="true">⚖️</div>
            <div>
                <p id="speedy-title" className="eyebrow" style={{ color: 'var(--accent)', letterSpacing: '0.14em', marginBottom: 6 }}>Long-pending case</p>
                <p className="serif" style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem', lineHeight: 1.4 }}>
                    This case has been pending {info.excessMonths} months longer than our {info.isCivil ? '3-year civil' : '1-year criminal'} reference point.
                </p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', lineHeight: 1.7, marginTop: 8 }}>
                    It has been pending for <strong style={{ color: '#fff' }}>{formatAge(info.ageMonths)}</strong>. That reference point is Vakalat&apos;s own rule of thumb, not a legal deadline — every case is different.
                </p>
                <div style={{ background: 'rgba(212,118,10,0.15)', padding: '16px 20px', marginTop: 16 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.8rem', color: '#f0a050', marginBottom: 6 }}>Things you could ask your lawyer about:</p>
                    <ul style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, paddingLeft: 20 }}>
                        <li><strong>Article 21</strong> of the Constitution has been read by the Supreme Court to include the right to a speedy trial. Ask whether it is relevant to your case.</li>
                        <li><strong>Section 89 CPC</strong> allows courts to refer civil disputes to mediation, Lok Adalat or arbitration.</li>
                        <li>&ldquo;Can we apply for an early hearing or priority listing?&rdquo;</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
