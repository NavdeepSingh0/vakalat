import { useState } from 'react';
import { buildICS, downloadICS, googleCalendarUrl, isIsoDate } from '../../calendar';
import { fmt } from '../../utils';

export default function CalendarShare({ d, stageName, waUrl }) {
    const [linkCopied, setLinkCopied] = useState(false);
    const valid = isIsoDate(d.nextHearingDate) && !d.isDisposed;

    const title = `Court hearing: ${d.petitioner || 'Case'} vs ${d.respondent || 'Respondent'}`;
    const description = [`Court: ${d.courtName || '—'}`, `CNR: ${d.cnr}`, `Stage: ${stageName || '—'}`, d.nextHearingPurpose ? `Purpose: ${d.nextHearingPurpose}` : ''].filter(Boolean).join('\n');

    const gcal = valid ? googleCalendarUrl({ dateISO: d.nextHearingDate, title, details: description, location: d.courtName }) : null;

    const onIcs = () => {
        const ics = buildICS({ uid: `${d.cnr}-${d.nextHearingDate}@vakalat`, dateISO: d.nextHearingDate, title, description, location: d.courtName });
        if (ics) downloadICS(`hearing_${d.cnr}_${d.nextHearingDate}.ics`, ics);
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch { /* clipboard unavailable (insecure context) — nothing to do */ }
    };

    return (
        <>
            {valid && (
                <section data-reveal aria-labelledby="cal-title" style={{ background: 'var(--ink-04)', border: '3px solid var(--ink-100)', padding: 'clamp(20px,4vw,28px) clamp(16px,4vw,40px)' }} className="share-bar">
                    <div>
                        <h2 id="cal-title" className="eyebrow" style={{ marginBottom: 6 }}>Never miss a hearing</h2>
                        <p className="serif" style={{ fontStyle: 'italic', color: 'var(--ink-90)', fontSize: '1.05rem', lineHeight: 1.4 }}>
                            Add your next hearing ({fmt(d.nextHearingDate)}) to your calendar.
                        </p>
                    </div>
                    <div className="btn-row">
                        <a href={gcal} target="_blank" rel="noopener noreferrer" className="btn">Google Calendar<span className="sr-only"> (opens in a new tab)</span></a>
                        <button type="button" className="btn btn-outline" onClick={onIcs}>Download .ics</button>
                    </div>
                </section>
            )}

            <section className="share-bar dark" data-reveal aria-labelledby="share-title" style={{ background: 'var(--ink-100)', padding: 'clamp(20px,4vw,28px) clamp(16px,4vw,40px)' }}>
                <div>
                    <h2 id="share-title" className="serif" style={{ fontStyle: 'italic', color: '#fff', fontSize: '1.1rem', fontWeight: 400 }}>Share this summary with your lawyer or family.</h2>
                    <p style={{ color: 'var(--ink-30)', fontSize: '0.8rem', marginTop: 4 }}>The WhatsApp message includes the case stage, court and next hearing date.</p>
                </div>
                <div className="btn-row">
                    <button type="button" className="btn btn-ghost-light" onClick={copyLink} aria-live="polite">{linkCopied ? 'Link copied ✓' : 'Copy link'}</button>
                    <a href={waUrl || undefined} target="_blank" rel="noopener noreferrer" className="btn btn-light" aria-disabled={!waUrl} style={waUrl ? undefined : { opacity: 0.5, pointerEvents: 'none' }}>
                        Share on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </div>
            </section>
        </>
    );
}
