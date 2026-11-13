import { Tag } from '../Shared';
import { fmt, STATUS_LABEL } from '../../utils';

const TAG_FOR = { adjourned: 'dark', heard: 'outline', disposed: 'muted', unclear: 'muted' };

export default function HearingTable({ hearings, stats, onReadOrder }) {
    const s = stats || { total: hearings.length, unproductive: 0, unproductiveRate: 0, heard: 0, adjourned: 0, unclear: 0, disposed: 0 };
    return (
        <section className="panel" data-reveal aria-labelledby="hearings-title">
            <div className="panel-head dark" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 id="hearings-title" className="panel-title">Hearing history</h2>
                <p>
                    <span className="mono" style={{ fontWeight: 500, color: '#fff', fontSize: '0.875rem' }}>{s.total} hearings</span>
                    <span style={{ color: 'var(--ink-30)', fontSize: '0.75rem' }}> — {s.unproductive} unproductive ({s.unproductiveRate}%)</span>
                </p>
            </div>
            <div style={{ height: 6, background: 'var(--ink-08)' }} role="img" aria-label={`${s.unproductiveRate}% of hearings were adjourned or unclear`}>
                <div style={{ height: '100%', width: `${s.unproductiveRate}%`, background: 'var(--ink-100)', transition: 'width 0.6s ease' }} />
            </div>
            <p className="hint" style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink-15)' }}>
                {s.heard} heard · {s.adjourned} adjourned · {s.unclear} unclear · {s.disposed} outcome. &ldquo;Unproductive&rdquo; = adjourned + unclear.
                Status is inferred from the court&apos;s one-line entry and can be wrong.
            </p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Hearing history table, scrollable">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Date</th>
                            <th scope="col">What happened</th>
                            <th scope="col">Status</th>
                            <th scope="col"><span className="sr-only">Order</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {hearings.map((h) => (
                            <tr key={h.id}>
                                <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmt(h.date)}</td>
                                <td style={{ maxWidth: 300 }}>{h.description}</td>
                                <td><Tag variant={TAG_FOR[h.status]}>{STATUS_LABEL[h.status]}</Tag></td>
                                <td>
                                    {h.hasOrder && (
                                        <button type="button" className="btn-link" onClick={() => onReadOrder(h)} aria-label={`Read the order for the hearing on ${fmt(h.date)}`}>
                                            Read order
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
