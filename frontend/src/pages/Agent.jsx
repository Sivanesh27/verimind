import { useCallback, useEffect, useRef, useState } from 'react';
import RunCard from '../components/agent/RunCard.jsx';
import { upsertStep } from '../components/agent/StepTimeline.jsx';
import { EmptyState, ErrorBanner } from '../components/ui/Badges.jsx';
import { api } from '../lib/api.js';
import { useSocketEvent } from '../context/SocketContext.jsx';

const SCENARIOS = [
  { label: 'Factual', query: 'What is the capital of Australia?' },
  { label: 'Hallucination trap', query: 'Why did Albert Einstein win his second Nobel Prize?' },
  { label: 'Fabricated entity', query: 'What was the population of the Kingdom of Marovia in 1850?' },
  { label: 'Ambiguous', query: 'Is it safe to take it with alcohol?' },
  { label: 'Tool check', query: 'What is 48731 multiplied by 9257?' },
  { label: 'High-stakes', query: 'What is the maximum safe daily dose of acetaminophen for an adult?' },
  { label: 'Real-time', query: 'What is the exact price of Bitcoin right now?' },
];

const MODES = [
  { id: 'trust', label: 'Trust-aware' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'compare', label: 'Compare both' },
];

export default function Agent() {
  const [runs, setRuns] = useState({}); // id -> run
  const [order, setOrder] = useState([]); // ids, oldest first
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('trust');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const upsert = useCallback((id, patch) => {
    setRuns((prev) => ({ ...prev, [id]: { id, steps: [], ...prev[id], ...(typeof patch === 'function' ? patch(prev[id] || { steps: [] }) : patch) } }));
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  useEffect(() => {
    api('/api/agent/runs')
      .then(({ runs: list }) => {
        const recent = list.slice(0, 10).reverse();
        setRuns(Object.fromEntries(recent.map((r) => [r.id, r])));
        setOrder(recent.map((r) => r.id));
      })
      .catch((err) => setError(err.message));
  }, []);

  // Braces matter: an effect must return nothing or a cleanup function (newer browsers return a Promise here).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [order.length]);

  // Realtime: steps stream in while the agent works; completion replaces the placeholder.
  useSocketEvent('run:step', ({ runId, step }) => upsert(runId, (r) => ({ steps: upsertStep(r.steps, step) })));
  useSocketEvent('run:complete', (run) => upsert(run.id, (r) => ({ ...run, steps: run.steps?.length ? run.steps : r.steps })));
  useSocketEvent('run:reviewed', (run) => setRuns((prev) => (prev[run.id] ? { ...prev, [run.id]: { ...prev[run.id], ...run } } : prev)));

  async function ask(text, { parentRunId } = {}) {
    setError('');
    setSending(true);
    const modes = parentRunId ? ['trust'] : mode === 'compare' ? ['baseline', 'trust'] : [mode];
    try {
      for (const m of modes) {
        const { run } = await api('/api/agent/ask', { method: 'POST', body: { query: text, mode: m, parentRunId } });
        upsert(run.id, (r) => ({ ...run, steps: r.steps }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    ask(query.trim());
    setQuery('');
  }

  function clarify(parent, reply) {
    upsert(parent.id, { answeredClarification: true });
    ask(reply, { parentRunId: parent.id });
  }

  return (
    <div className="agent-page">
      <div className="page-head">
        <div>
          <h1>Agent</h1>
          <p className="muted">Ask anything. Watch the agent estimate its confidence and decide what to do.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Agent mode">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      <div className="chips">
        {SCENARIOS.map((s) => (
          <button key={s.label} className="chip" onClick={() => setQuery(s.query)} title={s.query}>{s.label}</button>
        ))}
      </div>

      <div className="conversation">
        {order.length === 0 ? (
          <EmptyState title="No questions yet">Try one of the scenarios above — e.g. a hallucination trap — and compare it with the baseline agent.</EmptyState>
        ) : (
          order.map((id) => runs[id] && <RunCard key={id} run={runs[id]} onClarify={clarify} defaultExpanded={runs[id].status === 'running' || !runs[id].status} />)
        )}
        <div ref={bottomRef} />
      </div>

      <ErrorBanner error={error} />
      <form className="composer" onSubmit={submit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder="Ask a question…  (Enter to send, Shift+Enter for a new line)"
          rows={2}
          maxLength={2000}
          aria-label="Question"
        />
        <button className="btn primary" disabled={sending || !query.trim()}>{sending ? 'Sending…' : 'Ask'}</button>
      </form>
    </div>
  );
}
