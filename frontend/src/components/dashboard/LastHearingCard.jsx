import { Tag } from '../Shared';
import { fmt, STATUS_LABEL } from '../../utils';

function countdown(days) {
    if (days === null || days === undefined) return '';
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
    if (days === 0) return 'today';
    return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Most recent past hearing + the upcoming date (with a countdown) and its purpose. */
export default function LastHearingCard({ hearing, d, daysUntil }) {
    if (!hearing) return null;
    const when = countdown(daysUntil);
    return (
        <section className="dark" data-reveal aria-labelledby="last-title" style={{ background: 'var(--ink-100)', padding: 'clamp(20px, 4vw, 32px)' }}>
            <h2 id="last-title" className="eyebrow" style={{ color: 'var(--ink-30)', letterSpacing: '0.14em' }}>Last hearing</h2>
            <p className="mono" style={{ color: 'var(--ink-50)', fontSize: '0.8rem', marginTop: 4 }}>{fmt(hearing.date)}</p>
            <div style={{ marginTop: 16 }}>
                <Tag variant={hearing.status === 'adjourned' ? 'white-outline' : 'dark'} style={hearing.status === 'heard' ? { background: '#fff', color: 'var(--ink-100)' } : undefined}>
                    {STATUS_LABEL[hearing.status]}
                </Tag>
            </div>
            <p className="serif" style={{ fontStyle: 'italic', color: '#fff', fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', lineHeight: 1.4, marginTop: 24 }}>
                &ldquo;{hearing.description}&rdquo;
            </p>
            {!d.isDisposed && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 32, paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <p className="eyebrow" style={{ color: 'var(--ink-50)' }}>Next hearing date</p>
                        <p className="mono pulse" style={{ fontWeight: 600, color: '#fff', fontSize: '1.375rem', marginTop: 4 }}>{fmt(d.nextHearingDate)}</p>
                        {when && <p className="mono" style={{ color: 'var(--ink-30)', fontSize: '0.8rem', marginTop: 2 }}>{when}</p>}
                    </div>
                    {d.nextHearingPurpose && (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'var(--ink-30)', fontSize: '0.8rem' }}>Purpose of next hearing:</p>
                            <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem', marginTop: 4 }}>{d.nextHearingPurpose}</p>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
