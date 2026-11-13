import { useId, useState } from 'react';
import { fmt } from '../../utils';

export default function QuestionsAccordion({ data, nextDate }) {
    const [open, setOpen] = useState(null);
    const [copied, setCopied] = useState(false);
    const base = useId();
    if (!data) return null;

    const items = [...data.questions, ...(data.contextualQuestions || [])];
    if (!items.length) return null;

    const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    };
    const copyAll = async () => {
        if (await copy(items.map((q, i) => `${i + 1}. ${q.q}`).join('\n'))) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <section className="panel" data-reveal aria-labelledby="q-title">
            <div className="panel-head dark" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 id="q-title" className="panel-title">Questions for your lawyer</h2>
                    <p className="panel-sub">Stage {data.stage}: {data.stageName}{nextDate ? ` — for your hearing on ${fmt(nextDate)}` : ''}</p>
                </div>
                <button type="button" className="btn btn-ghost-light" onClick={copyAll} aria-live="polite">{copied ? 'Copied ✓' : 'Copy all'}</button>
            </div>
            {items.map((item, i) => {
                const isOpen = open === i;
                const panelId = `${base}-p${i}`;
                return (
                    <div key={item.q} style={{ borderBottom: '1px solid var(--ink-15)' }}>
                        <h3>
                            <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : i)}
                                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '20px clamp(16px,3vw,32px)', background: 'transparent', border: 'none', textAlign: 'left' }}>
                                <span style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                    <span className="mono muted" style={{ fontWeight: 600, fontSize: '0.7rem', marginTop: 3 }}>{String(i + 1).padStart(2, '0')}</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink-90)', lineHeight: 1.4 }}>{item.q}</span>
                                </span>
                                <span aria-hidden="true" className="mono muted" style={{ fontWeight: 600, fontSize: '1.5rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none' }}>+</span>
                            </button>
                        </h3>
                        <div id={panelId} className={`acc-panel ${isOpen ? 'open' : ''}`} inert={!isOpen}>
                            <div>
                                <div style={{ padding: '0 clamp(16px,3vw,32px) 20px clamp(16px,3vw,64px)' }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--ink-70)', lineHeight: 1.7 }}>{item.why}</p>
                                    <button type="button" className="btn-link" style={{ marginTop: 12 }} onClick={() => copy(item.q)}>Copy this question</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            <p className="hint" style={{ padding: '16px clamp(16px,3vw,32px)', fontStyle: 'italic' }}>
                These are general suggestions for each stage. Vakalat does not provide legal advice.
            </p>
        </section>
    );
}
