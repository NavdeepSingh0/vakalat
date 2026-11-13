import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Footer, SiteNav } from './Shared';
import { ApiError, getCase, getPrep, getQuestions, getStage, getWhatsAppLink } from '../services/api';
import { normalizeCaseData, speedyTrial, todayISO, useDocumentTitle, useReveal } from '../utils';
import CaseHeader from './dashboard/CaseHeader';
import SpeedyTrialAlert from './dashboard/SpeedyTrialAlert';
import StageProgress from './dashboard/StageProgress';
import CaseDetails from './dashboard/CaseDetails';
import LastHearingCard from './dashboard/LastHearingCard';
import HearingTable from './dashboard/HearingTable';
import CostCalculator from './dashboard/CostCalculator';
import QuestionsAccordion from './dashboard/QuestionsAccordion';
import PrepCard from './dashboard/PrepCard';
import CalendarShare from './dashboard/CalendarShare';
import OrderPanel from './dashboard/OrderPanel';

const settle = (promise) => promise.catch(() => null); // secondary data must never block the page

function PageShell({ children }) {
    return (
        <div style={{ background: 'var(--ink-00)' }}>
            <SiteNav variant="caseview" />
            <main id="main">{children}</main>
            <Footer />
        </div>
    );
}

export default function CaseDashboard() {
    const { cnr: rawCnr } = useParams();
    const cnr = (rawCnr || '').toUpperCase();

    // One result object keyed by the CNR it belongs to: a different CNR in the URL means "loading again".
    const [result, setResult] = useState({ cnr: null, error: null, caseData: null, extra: null });
    const [orderFor, setOrderFor] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // The case is required; the rest is loaded in parallel and is optional.
                const [raw, stage, questions, prep, wa] = await Promise.all([
                    getCase(cnr), settle(getStage(cnr)), settle(getQuestions(cnr)), settle(getPrep(cnr)), settle(getWhatsAppLink(cnr)),
                ]);
                if (cancelled) return;
                setResult({
                    cnr, error: null, caseData: normalizeCaseData(raw),
                    extra: { stage, questions, prep, wa: (wa && wa.whatsappUrl) || '' },
                });
            } catch (error) {
                if (!cancelled) setResult({ cnr, error, caseData: null, extra: null });
            }
        })();
        return () => { cancelled = true; };
    }, [cnr]);

    const status = result.cnr !== cnr ? 'loading' : result.error ? 'error' : 'ready';
    const { caseData, extra } = status === 'ready' ? result : { caseData: null, extra: null };
    const stateError = result.error;

    useDocumentTitle(caseData ? caseData.caseDetails.title || cnr : 'Loading case');
    useReveal(status === 'ready');
    const closeOrder = useCallback(() => setOrderFor(null), []);

    const d = caseData && caseData.caseDetails;
    const hearings = useMemo(() => (caseData ? caseData.hearings : []), [caseData]);
    const speedy = useMemo(() => (d ? speedyTrial(d) : null), [d]);
    const lastHearing = useMemo(() => {
        const today = todayISO();
        return hearings.find((h) => h.date && h.date <= today) || hearings[0] || null;
    }, [hearings]);

    if (status === 'loading') {
        return (
            <PageShell>
                <div className="container pad-x" style={{ padding: '80px var(--gutter)', minHeight: '60vh' }} role="status" aria-live="polite">
                    <p className="eyebrow">Loading case</p>
                    <div className="shimmer" style={{ height: 36, width: 'min(420px, 100%)', marginTop: 16 }} />
                    <div className="shimmer" style={{ height: 180, marginTop: 32 }} />
                </div>
            </PageShell>
        );
    }

    if (status === 'error') {
        const gone = stateError instanceof ApiError && (stateError.status === 404 || stateError.status === 400);
        return (
            <PageShell>
                <div className="container" style={{ padding: '80px var(--gutter)', minHeight: '60vh' }} role="alert">
                    <p className="eyebrow">{gone ? 'Case not available' : 'Something went wrong'}</p>
                    <h1 className="serif" style={{ fontSize: '1.75rem', margin: '12px 0', maxWidth: 560 }}>
                        {gone ? "We couldn't find this case." : "We couldn't load this case."}
                    </h1>
                    <p className="muted" style={{ maxWidth: 560, lineHeight: 1.7 }}>
                        {gone
                            ? 'Live cases are only kept in memory for a short while, so this one may have expired. Look it up again to reload it.'
                            : stateError.message}
                    </p>
                    <div className="btn-row" style={{ marginTop: 24 }}>
                        <Link className="btn" to={`/track?cnr=${encodeURIComponent(cnr)}${gone ? '&expired=1' : ''}`}>Look it up again</Link>
                        <Link className="btn btn-outline" to="/">Home</Link>
                    </div>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <CaseHeader d={d} />
            <div className="pad-x" style={{ paddingTop: speedy ? 32 : 0 }}><SpeedyTrialAlert info={speedy} /></div>

            <div className="container pad-x" style={{ paddingTop: 40, paddingBottom: 40 }}>
                {caseData.isDemo && (
                    <p className="hint" role="note" style={{ marginBottom: 24, padding: '10px 14px', background: 'var(--ink-04)', border: '1px solid var(--ink-15)' }}>
                        This is a <strong>fictional demo case</strong>. Nothing here refers to a real person.
                    </p>
                )}
                <div className="dash-grid">
                    <div className="stack">
                        <StageProgress stage={extra.stage} />
                        <CaseDetails d={d} />
                    </div>
                    <div className="stack">
                        <LastHearingCard hearing={lastHearing} d={d} daysUntil={extra.prep ? extra.prep.daysUntilNextHearing : null} />
                        <HearingTable hearings={hearings} stats={caseData.stats} onReadOrder={setOrderFor} />
                    </div>
                </div>
            </div>

            <div className="container pad-x stack" style={{ paddingBottom: 40 }}>
                <CostCalculator cnr={cnr} stats={caseData.stats} />
                <QuestionsAccordion data={extra.questions} nextDate={d.nextHearingDate} />
                <PrepCard prep={extra.prep} />
                <CalendarShare d={d} stageName={extra.stage && extra.stage.currentStageName} waUrl={extra.wa} />
            </div>

            {orderFor && <OrderPanel cnr={cnr} hearing={orderFor} isDemo={caseData.isDemo} onClose={closeOrder} />}
        </PageShell>
    );
}
