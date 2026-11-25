import ConfidenceGauge from '../ui/ConfidenceGauge.jsx';
import { RouteBadge } from '../ui/Badges.jsx';
import { confidenceTone, pct, ROUTE_META } from '../../lib/format.js';

const SEVERITY_ICON = { high: '▲', medium: '●', low: '○', positive: '✓' };

export default function ConfidencePanel({ run }) {
  const contributions = run.signals?.contributions || [];
  const caps = run.signals?.caps || [];
  const factors = run.explanation || [];
  const path = run.signals?.path || [];

  return (
    <div className="confidence-panel">
      <div className="confidence-head">
        <ConfidenceGauge value={run.confidence} />
        <div>
          <div className="muted small">Decision</div>
          <RouteBadge route={run.route} />
          <p className="small">{ROUTE_META[run.route]?.help}</p>
          {path.length > 1 && <p className="muted small">Path: {path.join(' → ')}</p>}
        </div>
      </div>

      {factors.length > 0 && (
        <section>
          <h4>Why this confidence?</h4>
          <ul className="factors">
            {factors.map((f, i) => (
              <li key={i} className={`factor sev-${f.severity}`}>
                <span className="factor-icon" aria-hidden>{SEVERITY_ICON[f.severity]}</span>
                <div>
                  <strong>{f.label}</strong>
                  <div className="muted small">{f.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {contributions.length > 0 && (
        <section>
          <h4>Signals</h4>
          <div className="signals">
            {contributions.map((c) => (
              <div key={c.signal} className="signal-row">
                <span className="signal-label">{c.label}</span>
                <div className="bar"><div className={`bar-fill tone-${confidenceTone(c.value)}`} style={{ width: `${c.value * 100}%` }} /></div>
                <span className="signal-value">{pct(c.value)}</span>
                <span className="muted small signal-weight">w {c.weight}</span>
              </div>
            ))}
          </div>
          {caps.map((c, i) => (
            <div key={i} className="alert warn small">Capped at {pct(c.limit)}: {c.reason}</div>
          ))}
        </section>
      )}

      {run.sources?.length > 0 && (
        <section>
          <h4>Sources</h4>
          <ul className="sources">
            {run.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                <span className="muted small"> · {s.source} · reliability {pct(s.reliability)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
