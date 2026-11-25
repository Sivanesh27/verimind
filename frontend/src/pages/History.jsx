import { useEffect, useMemo, useState } from 'react';
import RunCard from '../components/agent/RunCard.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Badges.jsx';
import { api } from '../lib/api.js';
import { ROUTE_META } from '../lib/format.js';
import { useSocketEvent } from '../context/SocketContext.jsx';

export default function History() {
  const [runs, setRuns] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/agent/runs').then((d) => setRuns(d.runs)).catch((e) => setError(e.message));
  }, []);

  const merge = (run) => setRuns((prev) => prev && (prev.some((r) => r.id === run.id) ? prev.map((r) => (r.id === run.id ? { ...r, ...run } : r)) : [run, ...prev]));
  useSocketEvent('run:complete', merge);
  useSocketEvent('run:reviewed', merge);

  const visible = useMemo(
    () => (runs || []).filter((r) => (filter === 'all' || r.route === filter) && r.query.toLowerCase().includes(search.toLowerCase())),
    [runs, filter, search],
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p className="muted">Your audit trail: every decision with its confidence, reasoning and sources.</p>
        </div>
      </div>
      <div className="toolbar">
        <input placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by route">
          <option value="all">All decisions</option>
          {Object.entries(ROUTE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <ErrorBanner error={error} />
      {!runs ? <Spinner /> : visible.length === 0 ? (
        <EmptyState title="Nothing here yet">Questions you ask the agent will appear here.</EmptyState>
      ) : (
        <div className="conversation">{visible.map((r) => <RunCard key={r.id} run={r} defaultExpanded={false} />)}</div>
      )}
    </div>
  );
}
