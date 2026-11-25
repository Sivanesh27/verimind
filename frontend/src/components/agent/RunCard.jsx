import { useState } from 'react';
import StepTimeline from './StepTimeline.jsx';
import ConfidencePanel from './ConfidencePanel.jsx';
import { ConfidencePill, RouteBadge, Spinner } from '../ui/Badges.jsx';
import { ms, timeAgo } from '../../lib/format.js';

export default function RunCard({ run, onClarify, defaultExpanded = true }) {
  const [showDetails, setShowDetails] = useState(defaultExpanded);
  const [reply, setReply] = useState('');
  const running = run.status === 'running' || !run.status;
  const failed = run.status === 'failed';
  const isBaseline = run.mode === 'baseline';
  const canReply = run.route === 'clarify' && onClarify && !run.answeredClarification;

  return (
    <article className="run">
      <div className="bubble user">
        <p>{run.query}</p>
        <div className="muted small">{isBaseline ? 'Baseline agent' : 'Trust-aware agent'} · {timeAgo(run.created_at || Date.now())}</div>
      </div>

      <div className="bubble agent">
        {running ? (
          <div className="thinking"><Spinner small /> Estimating confidence…</div>
        ) : failed ? (
          <div className="alert error">The agent failed: {run.error || 'unknown error'}</div>
        ) : (
          <>
            <div className="run-meta">
              <RouteBadge route={run.route} />
              <ConfidencePill value={run.confidence} level={run.level} />
              {run.answered_by === 'human' && <span className="badge tone-info">Answered by human reviewer</span>}
              {run.latency_ms != null && <span className="muted small">{ms(run.latency_ms)}</span>}
            </div>
            <p className="answer">{run.answer}</p>
          </>
        )}

        {canReply && (
          <form
            className="clarify-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) onClarify(run, reply.trim());
              setReply('');
            }}
          >
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Answer the clarifying question…" aria-label="Clarification" />
            <button className="btn primary" type="submit">Reply</button>
          </form>
        )}

        {!isBaseline && (
          <>
            <button className="link-btn small" onClick={() => setShowDetails((s) => !s)}>
              {showDetails ? 'Hide reasoning' : 'Show reasoning & confidence'}
            </button>
            {showDetails && (
              <div className="run-details">
                <StepTimeline steps={run.steps} />
                {!running && !failed && run.confidence != null && <ConfidencePanel run={run} />}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
