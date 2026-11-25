import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConfidencePill, ErrorBanner, RouteBadge, Spinner } from '../components/ui/Badges.jsx';
import { api } from '../lib/api.js';
import { ms, pct, ROUTE_META, timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';

const ROUTE_COLORS = { answer: 'var(--high)', verify: 'var(--medium)', specialist: '#a78bfa', clarify: 'var(--info)', escalate: 'var(--low)' };
const tooltipStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' };

export default function Monitor() {
  const { isStaff } = useAuth();
  const [scope, setScope] = useState(isStaff ? 'all' : 'mine');
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api(`/api/monitor/stats?scope=${scope}`), api('/api/monitor/recent')])
      .then(([s, r]) => {
        setData(s);
        setFeed(r.runs);
      })
      .catch((e) => setError(e.message));
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('monitor:run-started', (run) => setFeed((f) => [{ ...run, status: 'running', created_at: run.createdAt }, ...f].slice(0, 30)));
  useSocketEvent('monitor:run-completed', (run) => {
    setFeed((f) => (f.some((x) => x.id === run.id) ? f.map((x) => (x.id === run.id ? run : x)) : [run, ...f]).slice(0, 30));
    load();
  });

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;
  const { stats, escalations, thresholds } = data;
  const routeData = stats.routes.map((r) => ({ name: ROUTE_META[r.route]?.label || r.route, route: r.route, value: r.count }));
  const escalated = stats.routes.find((r) => r.route === 'escalate')?.count || 0;
  const histogram = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i * 10}-${i * 10 + 10}%`, count: stats.histogram.find((h) => h.bucket === i + 1)?.count || 0 }));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Monitor</h1>
          <p className="muted">Live confidence, routing and escalation metrics (last 30 days). Thresholds: high ≥ {pct(thresholds.high)}, medium ≥ {pct(thresholds.medium)}.</p>
        </div>
        {isStaff && (
          <div className="segmented">
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All users</button>
            <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>Mine</button>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <Stat label="Agent runs" value={stats.total} />
        <Stat label="Avg confidence" value={pct(stats.avg_confidence)} />
        <Stat label="Avg response time" value={ms(stats.avg_latency_ms)} />
        <Stat label="Escalation rate" value={pct(stats.total ? escalated / stats.total : 0)} />
        <Stat label="Failed runs" value={stats.failed} />
        {escalations && <Stat label="Open escalations" value={escalations.open || 0} />}
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3>Decision routes</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={routeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {routeData.map((d) => <Cell key={d.route} fill={ROUTE_COLORS[d.route] || 'var(--muted)'} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">{routeData.map((d) => <span key={d.route}><i style={{ background: ROUTE_COLORS[d.route] }} />{d.name} ({d.value})</span>)}</div>
        </div>
        <div className="card">
          <h3>Confidence distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={histogram}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card wide">
          <h3>Daily runs & average confidence</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats.daily}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis yAxisId="l" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 1]} tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === 'avg_confidence' ? pct(v) : v)} />
              <Line yAxisId="l" type="monotone" dataKey="runs" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="avg_confidence" stroke="var(--high)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Live activity <span className="live-dot on">Live</span></h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Question</th><th>User</th><th>Decision</th><th>Confidence</th><th>Time</th><th /></tr></thead>
            <tbody>
              {feed.map((r) => (
                <tr key={r.id}>
                  <td className="truncate">{r.query}</td>
                  <td>{r.user_name || '—'}</td>
                  <td>{r.status === 'running' ? <Spinner small /> : <RouteBadge route={r.route} />}</td>
                  <td><ConfidencePill value={r.confidence} /></td>
                  <td>{ms(r.latency_ms)}</td>
                  <td className="muted small">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
