import { useEffect, useRef, useState } from 'react';
import { getOrderSummary, orderPdfUrl } from '../../services/api';
import { fmt } from '../../utils';

/** Modal that shows the plain-English summary of one court order, with a link to the original PDF. */
export default function OrderPanel({ cnr, hearing, isDemo, onClose }) {
    const [state, setState] = useState({ status: 'loading', data: null, error: null });
    const closeRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        getOrderSummary(cnr, hearing.id)
            .then((data) => { if (!cancelled) setState({ status: 'ready', data, error: null }); })
            .catch((error) => { if (!cancelled) setState({ status: 'error', data: null, error }); });
        return () => { cancelled = true; };
    }, [cnr, hearing.id]);

    // Focus the close button on open, close on Escape, and restore focus on unmount.
    useEffect(() => {
        const previous = document.activeElement;
        closeRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
    }, [onClose]);

    const { status, data, error } = state;
    const message = error && (
        error.code === 'session_expired' ? 'Your eCourts session has expired. Search for this case again to read its orders.'
            : error.code === 'ai_unavailable' ? 'AI summaries are not turned on for this server. You can still open the original order.'
                : error.message
    );

    return (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="order-title">
                <div className="panel-head dark" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                        <h2 id="order-title" className="panel-title">Order of {fmt(hearing.date)}</h2>
                        <p className="panel-sub">{hearing.description}</p>
                    </div>
                    <button ref={closeRef} type="button" className="btn btn-ghost-light" onClick={onClose} aria-label="Close order summary">Close</button>
                </div>
                <div className="panel-body" style={{ padding: 'clamp(16px,3vw,28px)' }} aria-live="polite" aria-busy={status === 'loading'}>
                    {status === 'loading' && <p className="muted">Reading the order<span className="dot" /><span className="dot" /><span className="dot" /></p>}
                    {status === 'error' && <p role="alert" style={{ color: 'var(--ink-90)', fontWeight: 600 }}>{message}</p>}
                    {status === 'ready' && (
                        <>
                            <p className="eyebrow">In plain English</p>
                            <p style={{ fontSize: '1rem', lineHeight: 1.7, marginTop: 8 }}>{data.summary}</p>
                            {data.actions.length > 0 && (
                                <>
                                    <p className="eyebrow" style={{ marginTop: 24 }}>What each side must do</p>
                                    <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7, fontSize: '0.9rem' }}>{data.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                                </>
                            )}
                            {data.deadlines.length > 0 && (
                                <>
                                    <p className="eyebrow" style={{ marginTop: 24 }}>Dates and deadlines</p>
                                    <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7, fontSize: '0.9rem' }}>{data.deadlines.map((a) => <li key={a}>{a}</li>)}</ul>
                                </>
                            )}
                            {data.nextHearingPurpose && (
                                <>
                                    <p className="eyebrow" style={{ marginTop: 24 }}>Next hearing</p>
                                    <p style={{ marginTop: 8, fontSize: '0.9rem' }}>{data.nextHearingPurpose}</p>
                                </>
                            )}
                        </>
                    )}
                    <div className="btn-row" style={{ marginTop: 28 }}>
                        <a className="btn btn-outline" href={orderPdfUrl(cnr, hearing.id)} target="_blank" rel="noopener noreferrer">
                            Open original order<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    </div>
                    <p className="hint" style={{ marginTop: 16, fontStyle: 'italic' }}>
                        {isDemo || (data && data.sample)
                            ? 'This is a fictional sample order with a pre-written summary, shown for demonstration.'
                            : 'Summary generated by AI from the order text. It can contain mistakes — read the original order and check with your lawyer. Not legal advice.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
