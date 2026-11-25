import { useCallback, useEffect, useState } from 'react';
import { ConfidencePill, EmptyState, ErrorBanner, Spinner } from '../components/ui/Badges.jsx';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { useSocketEvent } from '../context/SocketContext.jsx';

const TABS = ['open', 'resolved', 'dismissed'];

export default function Review() {
  const [tab, setTab] = useState('open');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/api/escalations?status=${tab}`).then((d) => setItems(d.escalations)).catch((e) => setError(e.message));
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('escalation:new', load);
  useSocketEvent('escalation:updated', load);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Review queue</h1>
          <p className="muted">Questions the agent was not confident enough to answer. Your answer is delivered to the user in real time and by email.</p>
        </div>
        <div className="segmented">
          {TABS.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>
      <ErrorBanner error={error} />
      {!items ? <Spinner /> : items.length === 0 ? (
        <EmptyState title={`No ${tab} escalations`}>Escalations appear here the moment the agent hands a question over.</EmptyState>
      ) : (
        <div className="stack">{items.map((e) => <EscalationCard key={e.id} esc={e} onDone={load} />)}</div>
      )}
    </div>
  );
}

function EscalationCard({ esc, onDone }) {
  const [resolution, setResolution] = useState(esc.draft_answer || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/escalations/${esc.id}/resolve`, { method: 'POST', body: { action, resolution } });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const concerns = (esc.explanation || []).filter((f) => f.severity !== 'positive');
  return (
    <div className="card">
      <div className="row between">
        <div>
          <strong>{esc.query}</strong>
          <div className="muted small">{esc.user_name} · {timeAgo(esc.created_at)}</div>
        </div>
        <ConfidencePill value={esc.confidence} />
      </div>
      <ul className="factors compact">
        {concerns.map((f, i) => <li key={i} className={`factor sev-${f.severity}`}><strong>{f.label}</strong> <span className="muted small">{f.detail}</span></li>)}
      </ul>
      {esc.status === 'open' ? (
        <>
          <label className="small muted">Agent's unverified draft — edit before sending
            <textarea rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </label>
          <ErrorBanner error={error} />
          <div className="row">
            <button className="btn primary" disabled={busy || !resolution.trim()} onClick={() => act('resolve')}>Send answer</button>
            <button className="btn ghost" disabled={busy} onClick={() => act('dismiss')}>Dismiss</button>
          </div>
        </>
      ) : (
        <div className="resolution">
          <div className="muted small">{esc.status} by {esc.reviewer_name || '—'} · {esc.resolved_at && timeAgo(esc.resolved_at)}</div>
          {esc.resolution && <p>{esc.resolution}</p>}
        </div>
      )}
    </div>
  );
}
