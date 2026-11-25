import { ms } from '../../lib/format.js';
import { Spinner } from '../ui/Badges.jsx';

export default function StepTimeline({ steps = [] }) {
  if (!steps.length) return null;
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={`${s.key}-${i}`} className={`timeline-item ${s.status}`}>
          <span className="timeline-dot">{s.status === 'running' ? <Spinner small /> : s.status === 'failed' ? '✕' : '✓'}</span>
          <div className="timeline-body">
            <div className="timeline-title">
              {s.label}
              {s.durationMs > 0 && <span className="muted small"> · {ms(s.durationMs)}</span>}
            </div>
            {s.detail && <div className="muted small">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Merge a streamed step into the list: a finished step replaces its running counterpart. */
export function upsertStep(steps = [], step) {
  const idx = steps.findIndex((s) => s.key === step.key && s.label === step.label && s.status === 'running');
  if (idx === -1) return [...steps, step];
  const next = steps.slice();
  next[idx] = step;
  return next;
}
