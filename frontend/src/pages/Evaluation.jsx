import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConfidencePill, EmptyState, ErrorBanner, RouteBadge } from '../components/ui/Badges.jsx';
import { api } from '../lib/api.js';
import { ms, pct, timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';

const METRICS = [
  { key: 'accuracy', label: 'Accuracy', better: 'higher' },
  { key: 'hallucinationRate', label: 'Hallucination rate', better: 'lower' },
  { key: 'failedDecisionRate', label: 'Failed decisions', better: 'lower' },
  { key: 'unnecessaryEscalationRate', label: 'Unnecessary escalations', better: 'lower' },
  { key: 'escalationRate', label: 'Escalation rate', better: 'context' },
  { key: 'clarificationRate', label: 'Clarification rate', better: 'context' },
];
const tooltipStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' };

export default function Evaluation() {
  const { isAdmin } = useAuth();
  const [runs, setRuns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const loadList = useCallback(() => api('/api/eval/runs').then((d) => setRuns(d.runs)).catch((e) => setError(e.message)), []);
  const open = useCallback((id) => api(`/api/eval/runs/${id}`).then((d) => setSelected(d.run)).catch((e) => setError(e.message)), []);

  useEffect(() => {
    loadList();
  }, [loadList]);
  useEffect(() => {
    if (!selected && runs[0]) open(runs[0].id);
  }, [runs, selected, open]);

  useSocketEvent('eval:started', () => loadList());
  useSocketEvent('eval:progress', ({ id, result }) => {
    setSelected((s) => (s?.id === id ? { ...s, completed: s.completed + 1, results: [...s.results, result] } : s));
    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, completed: r.completed + 1 } : r)));
  });
  useSocketEvent('eval:completed', ({ id }) => {
    loadList();
    open(id);
  });
  useSocketEvent('eval:failed', () => loadList());

  async function start() {
    setStarting(true);
    setError('');
    try {
      const { run } = await api('/api/eval/runs', { method: 'POST', body: {} });
      await loadList();
      setSelected({ ...run, results: [] });
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  const summary = selected?.summary;
  const anyRunning = runs.some((r) => r.status === 'running');

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Evaluation</h1>
          <p className="muted">Traditional (baseline) agent vs. trust-aware agent across factual, long-tail, fabricated, ambiguous, tool and high-stakes scenarios.</p>
        </div>
        {isAdmin && <button className="btn primary" onClick={start} disabled={starting || anyRunning}>{anyRunning ? 'Evaluation running…' : 'Run evaluation'}</button>}
      </div>
      <ErrorBanner error={error} />

      {runs.length === 0 ? (
        <EmptyState title="No evaluations yet">{isAdmin ? 'Start one to compare the agents. It calls the model ~10 times per scenario.' : 'An admin can start an evaluation.'}</EmptyState>
      ) : (
        <>
          <div className="chips">
            {runs.map((r) => (
              <button key={r.id} className={`chip ${selected?.id === r.id ? 'active' : ''}`} onClick={() => open(r.id)}>
                {timeAgo(r.created_at)} · {r.status === 'running' ? `${r.completed}/${r.total}` : r.status}
              </button>
            ))}
          </div>

          {selected?.status === 'running' && (
            <div className="card">
              <div className="row between"><strong>Running…</strong><span className="muted">{selected.completed}/{selected.total} scenarios</span></div>
              <div className="bar big"><div className="bar-fill tone-info" style={{ width: `${(selected.completed / selected.total) * 100}%` }} /></div>
            </div>
          )}
          {selected?.status === 'failed' && <div className="alert error">Evaluation failed: {selected.error}</div>}

          {summary && <Summary summary={summary} />}
          {selected?.results?.length > 0 && <ResultsTable results={selected.results} />}
        </>
      )}
    </div>
  );
}

function Summary({ summary }) {
  const { baseline, trust } = summary;
  const chart = METRICS.slice(0, 4).map((m) => ({ metric: m.label, Baseline: baseline[m.key], 'Trust-aware': trust[m.key] }));
  const reliability = (trust.reliability || []).filter((b) => b.count > 0).map((b) => ({ conf: b.avgConfidence, acc: b.accuracy, range: b.range, count: b.count }));

  return (
    <>
      <div className="card">
        <h3>Results</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Metric</th><th>Baseline</th><th>Trust-aware</th><th>Change</th></tr></thead>
            <tbody>
              {METRICS.map((m) => {
                const d = trust[m.key] - baseline[m.key];
                const good = m.better === 'higher' ? d > 0 : m.better === 'lower' ? d < 0 : null;
                return (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{pct(baseline[m.key], 1)}</td>
                    <td><strong>{pct(trust[m.key], 1)}</strong></td>
                    <td className={good === null || d === 0 ? 'muted' : good ? 'text-high' : 'text-low'}>{d > 0 ? '+' : ''}{(d * 100).toFixed(1)} pts</td>
                  </tr>
                );
              })}
              <tr><td>Avg response time</td><td>{ms(baseline.avgLatencyMs)}</td><td><strong>{ms(trust.avgLatencyMs)}</strong></td><td className="muted">cost of verification</td></tr>
              {trust.ece !== undefined && <tr><td>Calibration (ECE / Brier)</td><td className="muted">n/a — no confidence</td><td><strong>{trust.ece.toFixed(3)} / {trust.brier.toFixed(3)}</strong></td><td className="muted">lower is better</td></tr>}
              {trust.verification && <tr><td>Verification effectiveness</td><td className="muted">—</td><td><strong>{trust.verification.correctAfterVerification}/{trust.verification.runs}</strong> correct after verify</td><td /></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3>Baseline vs. trust-aware</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="metric" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => pct(v, 1)} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend />
              <Bar dataKey="Baseline" fill="var(--muted)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Trust-aware" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Reliability diagram (calibration)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={reliability}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="conf" type="number" domain={[0, 1]} tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => pct(v, 1)} labelFormatter={(v) => `confidence ${pct(v)}`} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--muted)" strokeDasharray="4 4" />
              <Line dataKey="acc" name="Observed accuracy" stroke="var(--accent)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="muted small">Points on the dashed diagonal mean the confidence score is perfectly calibrated.</p>
        </div>
      </div>
    </>
  );
}

const VERDICT_TONE = { correct: 'high', incorrect: 'low', abstained: 'medium' };

function ResultsTable({ results }) {
  return (
    <div className="card">
      <h3>Per-scenario results</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Scenario</th><th>Category</th><th>Baseline</th><th>Trust-aware</th><th>Decision</th><th>Confidence</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.item.id}>
                <td className="truncate" title={`${r.item.query}\n\nReference: ${r.item.reference}`}>{r.item.query}</td>
                <td className="muted">{r.item.category}</td>
                <td><span className={`badge tone-${VERDICT_TONE[r.baseline.verdict]}`} title={r.baseline.rationale}>{r.baseline.verdict}</span></td>
                <td><span className={`badge tone-${VERDICT_TONE[r.trust.verdict]}`} title={r.trust.rationale}>{r.trust.verdict}</span></td>
                <td><RouteBadge route={r.trust.route} /></td>
                <td><ConfidencePill value={r.trust.confidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
