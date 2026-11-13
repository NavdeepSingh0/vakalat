import { useEffect, useState } from 'react';
import { estimateCost, getCostConfig } from '../../services/api';

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/**
 * Estimated cost of the confirmed adjournments. All maths happens on the server
 * (POST /api/case/:cnr/cost) so there is a single formula; this component only collects inputs.
 */
export default function CostCalculator({ cnr, stats }) {
    const [options, setOptions] = useState(null);
    const [optionsError, setOptionsError] = useState(false);
    const [fee, setFee] = useState('32500');
    const [workerType, setWorkerType] = useState('salaried_formal');
    const [travelMode, setTravelMode] = useState('local');
    const [juniorCount, setJuniorCount] = useState(0);
    const [advanced, setAdvanced] = useState(false);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        getCostConfig()
            .then((o) => {
                if (cancelled) return;
                setOptions(o);
                setFee(String(o.defaults.seniorFeePerHearing));
                setWorkerType(o.defaults.workerType);
                setTravelMode(o.defaults.travelMode);
            })
            .catch(() => { if (!cancelled) setOptionsError(true); });
        return () => { cancelled = true; };
    }, []);

    // Debounced recalculation whenever an input changes.
    useEffect(() => {
        if (!options) return undefined;
        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            setBusy(true);
            setError('');
            try {
                const r = await estimateCost(cnr, {
                    seniorFeePerHearing: Math.max(0, Number(fee) || 0),
                    workerType, travelMode, juniorCount,
                }, ctrl.signal);
                setResult(r);
            } catch (err) {
                if (err.name !== 'AbortError') setError(err.message || 'Could not calculate the estimate.');
            } finally {
                if (!ctrl.signal.aborted) setBusy(false);
            }
        }, 300);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [cnr, options, fee, workerType, travelMode, juniorCount]);

    const heads = result && result.costHeadSummary;
    const s = stats || { heard: 0, adjourned: 0, unclear: 0, disposed: 0 };

    return (
        <section className="panel" data-reveal aria-labelledby="cost-title">
            <div className="panel-head dark">
                <h2 id="cost-title" className="panel-title">Financial drain calculator</h2>
                <p className="panel-sub">An estimate of what the confirmed adjournments may have cost you. Replace the assumed figures with your own.</p>
            </div>
            <div className="panel-body calc-grid" style={{ padding: 'clamp(16px, 3vw, 32px)' }}>
                <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
                    {optionsError && <p className="hint" role="alert">The calculator could not load its options. Is the backend running?</p>}
                    <div>
                        <label className="field-label" htmlFor="fee">Your lawyer&apos;s fee per appearance (₹)</label>
                        <input id="fee" className="input" type="number" inputMode="numeric" min={0} step={1000} value={fee} onChange={(e) => setFee(e.target.value)} disabled={!options} />
                    </div>
                    <div>
                        <label className="field-label" htmlFor="worker">Your work (lost earnings per day of court)</label>
                        <select id="worker" className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }} value={workerType} onChange={(e) => setWorkerType(e.target.value)} disabled={!options}>
                            {(options ? options.workerTypes : []).map((w) => <option key={w.id} value={w.id}>{w.label} (₹{w.perDay.toLocaleString('en-IN')}/day)</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="field-label" htmlFor="travel">Travel to court</label>
                        <select id="travel" className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }} value={travelMode} onChange={(e) => setTravelMode(e.target.value)} disabled={!options}>
                            {(options ? options.travelModes : []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <button type="button" className="btn-link" aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>
                            {advanced ? '− Hide' : '+ Show'} advanced options
                        </button>
                        {advanced && (
                            <div style={{ marginTop: 12 }}>
                                <label className="field-label" htmlFor="juniors">Extra junior advocates attending</label>
                                <input id="juniors" className="input" type="number" min={0} max={5} value={juniorCount}
                                    onChange={(e) => setJuniorCount(Math.min(5, Math.max(0, Math.round(Number(e.target.value) || 0))))} />
                                <p className="hint" style={{ marginTop: 6 }}>Your fee above is treated as the total for your main counsel; each junior adds roughly two-thirds of it (capped at ₹15,000).</p>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ background: 'var(--ink-04)', border: '1px solid var(--ink-15)', padding: 'clamp(16px, 3vw, 32px)', textAlign: 'center' }} aria-live="polite" aria-busy={busy}>
                    <p className="eyebrow">Estimated financial drain</p>
                    <p className="mono" style={{ fontWeight: 600, color: 'var(--ink-100)', fontSize: 'clamp(2rem,4vw,3rem)', marginTop: 16, lineHeight: 1, opacity: busy ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                        {result ? rupees(result.totalDrain) : '—'}
                    </p>
                    {error && <p className="hint" role="alert" style={{ marginTop: 12 }}>{error}</p>}

                    {heads && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24, padding: '16px 0', borderTop: '1px solid var(--ink-15)', flexWrap: 'wrap' }}>
                            {[['Legal fees', heads.professionalFees], ['Lost earnings', heads.opportunityCost], ['Travel & misc.', heads.travelStay + heads.incidentals]].map(([label, v]) => (
                                <div key={label} style={{ textAlign: 'left' }}>
                                    <p className="eyebrow" style={{ fontSize: '0.6rem' }}>{label}</p>
                                    <p className="mono" style={{ fontSize: '0.9rem', marginTop: 4 }}>{rupees(v)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="count-row" role="list" aria-label="Hearing counts">
                        {[['Heard', s.heard], ['Adjourned', s.adjourned], ['Unclear', s.unclear], ['Outcome', s.disposed]].map(([label, n]) => (
                            <div key={label} role="listitem">
                                <p className="mono" style={{ fontWeight: 600, fontSize: '1.1rem' }}>{n}</p>
                                <p className="eyebrow" style={{ fontSize: '0.6rem' }}>{label}</p>
                            </div>
                        ))}
                    </div>

                    {result && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--ink-70)', lineHeight: 1.6, textAlign: 'left' }}>
                            Based on <strong>{result.adjournedCount} confirmed adjournment{result.adjournedCount === 1 ? '' : 's'}</strong>
                            {result.unclearCount > 0 && <> · {result.unclearCount} unclear hearing{result.unclearCount === 1 ? '' : 's'} not counted</>}.
                            {result.recoverableFromOP > 0 && <> About {rupees(result.recoverableFromOP)} relates to adjournments recorded against the other side — ask your lawyer whether costs can be claimed.</>}
                        </p>
                    )}
                    <p className="hint" style={{ marginTop: 12, textAlign: 'left' }}>
                        {options ? options.disclaimer : 'Estimate only.'} Each adjournment is weighted by the stage of the case at that time and by who caused it.
                    </p>
                </div>
            </div>
        </section>
    );
}
