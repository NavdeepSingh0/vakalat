import { Tag } from '../Shared';

/** Case progress, driven by GET /api/case/:cnr/stage so the stage list lives in one place (the backend). */
export default function StageProgress({ stage }) {
    if (!stage) return null;
    return (
        <section className="panel" data-reveal aria-labelledby="stage-title">
            <div className="panel-head dark">
                <Tag variant="white-outline">CASE PROGRESS</Tag>
                <h2 id="stage-title" className="mono" style={{ fontWeight: 500, color: '#fff', fontSize: '0.875rem', marginTop: 8 }}>
                    Stage {stage.currentStage} of {stage.totalStages} — {stage.currentStageName}
                </h2>
            </div>
            <ol style={{ padding: 24, listStyle: 'none' }}>
                {stage.stages.map((s, i) => {
                    const status = s.status === 'completed' ? 'done' : s.status === 'current' ? 'current' : 'upcoming';
                    return (
                        <li key={s.stageNumber} aria-current={status === 'current' ? 'step' : undefined}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                <div aria-hidden="true" style={{
                                    width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: status === 'upcoming' ? 'transparent' : 'var(--ink-100)',
                                    border: status === 'upcoming' ? '2px solid var(--ink-30)' : status === 'current' ? '3px solid var(--ink-100)' : 'none',
                                    outline: status === 'current' ? '3px solid var(--ink-30)' : 'none', outlineOffset: status === 'current' ? 2 : 0,
                                }}>
                                    <span className="mono" style={{ fontWeight: 600, fontSize: '0.7rem', color: status === 'upcoming' ? 'var(--ink-50)' : '#fff' }}>
                                        {status === 'done' ? '✓' : s.stageNumber}
                                    </span>
                                </div>
                                <div style={{ flex: 1, paddingBottom: status === 'current' ? 0 : 8 }}>
                                    <p style={{
                                        fontWeight: status === 'current' ? 700 : 600, fontSize: status === 'current' ? '0.875rem' : '0.8rem',
                                        color: status === 'current' ? 'var(--ink-100)' : 'var(--ink-50)',
                                        textDecoration: status === 'done' ? 'line-through' : 'none',
                                    }}>
                                        {s.name}
                                        {status === 'done' && <span className="sr-only"> (completed)</span>}
                                    </p>
                                    {status === 'current' && <p style={{ fontSize: '0.8rem', color: 'var(--ink-70)', marginTop: 4, lineHeight: 1.6 }}>{s.description}</p>}
                                    {status === 'upcoming' && <p className="mono muted" style={{ fontSize: '0.7rem', marginTop: 2 }}>~{s.avgMonthsDistrict} months avg</p>}
                                </div>
                            </div>
                            {i < stage.stages.length - 1 && (
                                <div aria-hidden="true" style={{ width: 1, height: 16, background: status === 'done' ? 'var(--ink-100)' : 'var(--ink-15)', marginLeft: 15, marginTop: 2, marginBottom: 2 }} />
                            )}
                        </li>
                    );
                })}
            </ol>
            <div style={{ borderTop: '1px solid var(--ink-15)', padding: '16px 24px' }}>
                <p className="muted" style={{ fontSize: '0.75rem' }}>
                    Estimated time remaining: ~{stage.estimatedMonthsRemaining} months (general averages for district courts — your case may differ)
                </p>
            </div>
        </section>
    );
}
