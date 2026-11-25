import { ROUTE_META, confidenceTone, pct } from '../../lib/format.js';

export function RouteBadge({ route }) {
  if (!route) return null;
  const meta = ROUTE_META[route] || { label: route, tone: 'muted' };
  return <span className={`badge tone-${meta.tone}`} title={meta.help}>{meta.label}</span>;
}

export function ConfidencePill({ value, level }) {
  if (value === null || value === undefined) return null;
  return (
    <span className={`badge tone-${confidenceTone(value)}`}>
      {pct(value)} {level ? `· ${level}` : ''}
    </span>
  );
}

export function Spinner({ small }) {
  return <span className={`spinner ${small ? 'small' : ''}`} role="status" aria-label="Loading" />;
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="alert error">{error}</div>;
}
