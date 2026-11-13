import { useState } from 'react';
import { fmt } from '../../utils';

export default function PrepCard({ prep }) {
    const [checked, setChecked] = useState({});
    if (!prep) return null;
    const days = prep.daysUntilNextHearing;
    return (
        <section className="panel" aria-labelledby="prep-title">
            <div className="panel-head dark">
                <h2 id="prep-title" className="panel-title">Pre-hearing prep card</h2>
                <p className="panel-sub">
                    What to do before your next hearing on {fmt(prep.nextHearingDate)}
                    {days !== null && days !== undefined && days >= 0 && <> — {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} to go`}</>}
                </p>
            </div>
            <div className="panel-body" style={{ padding: 'clamp(16px,3vw,32px)' }}>
                {prep.currentStage && (
                    <div style={{ background: 'var(--ink-04)', padding: '16px 20px', marginBottom: 20 }}>
                        <p className="eyebrow" style={{ marginBottom: 6 }}>What to expect at stage {prep.currentStage.number}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--ink-70)', lineHeight: 1.6 }}>{prep.currentStage.whatToExpect}</p>
                    </div>
                )}
                <fieldset style={{ border: 'none' }}>
                    <legend className="eyebrow" style={{ marginBottom: 12 }}>Checklist</legend>
                    {prep.preparationChecklist.map((item, i) => (
                        <label key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--ink-08)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={Boolean(checked[i])} onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))} style={{ marginTop: 4 }} />
                            <span style={{ fontSize: '0.875rem', color: item.startsWith('⚠') ? '#8a4a00' : 'var(--ink-70)', lineHeight: 1.5, textDecoration: checked[i] ? 'line-through' : 'none' }}>{item}</span>
                        </label>
                    ))}
                </fieldset>
            </div>
        </section>
    );
}
