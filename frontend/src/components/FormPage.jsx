import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SiteNav, Footer, Tag } from './Shared';
import { useDocumentTitle } from '../utils';
import { fetchCaptcha, submitCNR, getDemoCases } from '../services/api';
import { CNR_RE } from '../utils';

const LEGEND = [['MH', 'State'], ['NA', 'District'], ['01', 'Court'], ['000001', 'Case no.'], ['2019', 'Year']];

export default function FormPage() {
    useDocumentTitle('Track a case');
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const [cnr, setCnr] = useState(() => (params.get('cnr') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
    const [courtType, setCourtType] = useState('district');
    const [captchaCode, setCaptchaCode] = useState('');
    const [cnrError, setCnrError] = useState('');
    const [error, setError] = useState(() => (params.get('expired') ? 'That case is no longer in memory. Enter the CNR and solve the CAPTCHA again to reload it.' : ''));
    const [loading, setLoading] = useState(false);

    const [captchaImg, setCaptchaImg] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [captchaLoading, setCaptchaLoading] = useState(false);

    const [demoCases, setDemoCases] = useState([]);
    const [demoError, setDemoError] = useState('');
    const [demoLoadingCnr, setDemoLoadingCnr] = useState('');

    const cnrValid = CNR_RE.test(cnr);
    const requestSeq = useRef(0);

    // The CAPTCHA is only fetched once there is a valid CNR to use it with — not on page load.
    const loadCaptcha = useCallback(async () => {
        const seq = ++requestSeq.current;
        setCaptchaLoading(true);
        setCaptchaCode('');
        try {
            const data = await fetchCaptcha(courtType);
            if (seq !== requestSeq.current) return;
            setCaptchaImg(data.captchaDataUrl);
            setSessionId(data.sessionId);
        } catch (err) {
            if (seq !== requestSeq.current) return;
            setCaptchaImg('');
            setSessionId('');
            setError(err.status === 429 ? 'Too many CAPTCHA requests. Please wait a minute and try again.' : 'Could not load a CAPTCHA from eCourts. It may be temporarily unavailable — the demo cases below still work.');
        } finally {
            if (seq === requestSeq.current) setCaptchaLoading(false);
        }
    }, [courtType]);

    useEffect(() => {
        if (cnrValid) loadCaptcha();
        else { requestSeq.current++; setCaptchaImg(''); setSessionId(''); }
    }, [cnrValid, loadCaptcha]);

    useEffect(() => {
        let cancelled = false;
        getDemoCases()
            .then((cases) => { if (!cancelled) setDemoCases(cases); })
            .catch(() => { if (!cancelled) setDemoError('Demo cases are unavailable right now (is the backend running?).'); });
        return () => { cancelled = true; };
    }, []);

    const handleCnr = (e) => {
        setCnr(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
        if (cnrError) setCnrError('');
    };

    const validateCnr = () => {
        if (!cnr.length) return;
        if (cnr.length !== 16) setCnrError(`CNR must be 16 characters. You have entered ${cnr.length}.`);
        else if (!CNR_RE.test(cnr)) setCnrError('A CNR is 4 letters followed by 12 digits, e.g. MHNA010000012019.');
        else setCnrError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cnrValid) { setCnrError('Enter a valid 16-character CNR (4 letters followed by 12 digits).'); return; }
        if (!captchaCode.trim()) { setError('Please enter the CAPTCHA code shown in the image.'); return; }
        if (!sessionId) { setError('No CAPTCHA is loaded. Use "Refresh" to get a new one.'); return; }

        setLoading(true);
        setError('');
        try {
            await submitCNR(cnr, captchaCode.trim(), sessionId);
            navigate(`/case/${cnr}`);
        } catch (err) {
            setError(err.message || 'Search failed. Please try again.');
            loadCaptcha();
        } finally {
            setLoading(false);
        }
    };

    const openDemo = (demoCnr) => {
        setDemoLoadingCnr(demoCnr);
        navigate(`/case/${demoCnr}`);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--ink-00)', display: 'flex', flexDirection: 'column' }}>
            <SiteNav />
            <main id="main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px var(--gutter)' }}>
                <div className="form-grid">
                    <form className="form-card" onSubmit={handleSubmit} noValidate aria-labelledby="form-title">
                        <Tag variant="dark">CNR LOOKUP</Tag>
                        <h1 id="form-title" className="serif" style={{ fontWeight: 700, fontSize: '1.75rem', marginTop: 16, lineHeight: 1.1 }}>Track your case.</h1>
                        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>Enter the 16-character CNR from your court papers.</p>

                        <fieldset style={{ border: 'none', marginTop: 24 }}>
                            <legend className="field-label">Court</legend>
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                {[['district', 'District / taluka court'], ['highcourt', 'High Court']].map(([value, label]) => (
                                    <label key={value} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                                        <input type="radio" name="courtType" value={value} checked={courtType === value} onChange={() => setCourtType(value)} />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <div style={{ marginTop: 24 }}>
                            <label className="field-label" htmlFor="cnr">CNR number</label>
                            <input
                                id="cnr" className="input" value={cnr} onChange={handleCnr} onBlur={validateCnr}
                                placeholder="e.g. MHNA010000012019" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                                aria-invalid={Boolean(cnrError)} aria-describedby="cnr-help"
                                style={{ letterSpacing: '0.04em', fontWeight: 500 }}
                            />
                            <div id="cnr-help" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, gap: 12 }}>
                                <span className="hint" role={cnrError ? 'alert' : undefined}>{cnrError}</span>
                                <span className="mono muted" style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>{cnr.length}/16</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 24 }} aria-live="polite">
                            <p className="field-label" id="captcha-label">CAPTCHA verification</p>
                            <div style={{ border: '2px solid var(--ink-15)', padding: '12px 16px', background: 'var(--ink-08)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 58 }}>
                                {captchaLoading ? (
                                    <div className="shimmer" style={{ width: 160, height: 34, borderRadius: 2 }} role="status" aria-label="Loading CAPTCHA" />
                                ) : captchaImg ? (
                                    <img src={captchaImg} alt="CAPTCHA — type the characters you see" style={{ height: 40, maxWidth: 200 }} />
                                ) : (
                                    <span className="mono muted" style={{ fontSize: '0.8rem' }}>
                                        {cnrValid ? 'No CAPTCHA loaded' : 'Enter a valid CNR to load the CAPTCHA'}
                                    </span>
                                )}
                                <button type="button" className="btn-link" onClick={loadCaptcha} disabled={!cnrValid || captchaLoading}>↺ Refresh</button>
                            </div>
                            <input
                                className="input" aria-labelledby="captcha-label" value={captchaCode} disabled={!sessionId}
                                onChange={(e) => { setCaptchaCode(e.target.value); setError(''); }}
                                placeholder="Enter CAPTCHA code" autoComplete="off" spellCheck={false}
                            />
                        </div>

                        {error && <div className="alert-error" role="alert">✕ &nbsp;{error}</div>}

                        <button type="submit" disabled={loading} className="btn" style={{ marginTop: 32, width: '100%', padding: '18px 0', fontSize: '0.875rem', letterSpacing: '0.1em' }}>
                            {loading ? <span>FETCHING CASE DATA &nbsp;<span className="dot" /><span className="dot" /><span className="dot" /></span> : 'TRACK THIS CASE →'}
                        </button>

                        <section id="demo" style={{ marginTop: 32 }} aria-labelledby="demo-title">
                            <div style={{ borderTop: '1px solid var(--ink-15)', marginBottom: 16 }} />
                            <h2 id="demo-title" className="eyebrow" style={{ marginBottom: 12 }}>Demo cases — fictional, no CAPTCHA needed</h2>
                            {demoError && <p className="hint" role="status">{demoError}</p>}
                            {demoCases.map((demo) => (
                                <button type="button" key={demo.cnr} className="demo-row" onClick={() => openDemo(demo.cnr)} disabled={Boolean(demoLoadingCnr)}>
                                    <span className="mono" style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--ink-90)' }}>{demo.cnr}</span>
                                    <span className="muted" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{demo.title}</span>
                                </button>
                            ))}
                        </section>
                    </form>

                    <aside className="context-panel" aria-label="Help finding your CNR">
                        <p className="eyebrow">Where to find your CNR</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink-70)', marginTop: 16, lineHeight: 1.7 }}>
                            Your Case Number Record (CNR) is a 16-character code that uniquely identifies your case in the Indian court system:
                        </p>
                        <div className="dark" style={{ background: 'var(--ink-100)', padding: '14px 20px', marginTop: 16 }}>
                            <p className="mono" style={{ fontWeight: 600, color: '#fff', fontSize: '1.05rem', letterSpacing: '0.04em' }}>MH NA 01 000001 2019</p>
                            <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                                {LEGEND.map(([code, label]) => (
                                    <div key={code}>
                                        <p className="mono" style={{ fontWeight: 600, color: 'var(--ink-30)', fontSize: '0.75rem' }}>{code}</p>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--ink-50)', marginTop: 2 }}>{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid var(--ink-15)', margin: '24px 0' }} />
                        <p className="eyebrow">You can find it on</p>
                        <ul style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none' }}>
                            {['Your original court petition (vakalatnama)', 'Any court notice or summons you received', "Your advocate's case tracking receipts", 'The eCourts Services app (search by name)'].map((t) => (
                                <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: '0.875rem', color: 'var(--ink-70)' }}>
                                    <span className="mono" aria-hidden="true" style={{ fontWeight: 700, color: 'var(--ink-100)' }}>—</span>{t}
                                </li>
                            ))}
                        </ul>
                        <div style={{ borderTop: '1px solid var(--ink-15)', margin: '24px 0' }} />
                        <p className="eyebrow" style={{ marginBottom: 12 }}>About this data</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--ink-70)', lineHeight: 1.7 }}>
                            Vakalat fetches data from eCourts.gov.in. Accuracy depends on what the court has entered. Live results are kept in server memory for a short time and are not written to disk.
                        </p>
                    </aside>
                </div>
            </main>
            <Footer />
        </div>
    );
}
