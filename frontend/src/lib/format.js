export const pct = (n, digits = 0) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(digits)}%`);

export const ms = (n) => (n === null || n === undefined ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);

export function timeAgo(date) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export const ROUTE_META = {
  answer: { label: 'Answered', tone: 'high', help: 'High confidence — answered directly' },
  verify: { label: 'Verified', tone: 'medium', help: 'Medium confidence — searched / verified, then re-evaluated' },
  clarify: { label: 'Clarifying', tone: 'info', help: 'Low confidence — asked a clarifying question' },
  specialist: { label: 'Specialist', tone: 'medium', help: 'Low confidence — handed over to a specialist agent' },
  escalate: { label: 'Escalated', tone: 'low', help: 'Low confidence — escalated to a human reviewer' },
};

export const levelTone = (level) => (level === 'high' ? 'high' : level === 'medium' ? 'medium' : level === 'low' ? 'low' : 'muted');

export const confidenceTone = (c) => (c === null || c === undefined ? 'muted' : c >= 0.8 ? 'high' : c >= 0.55 ? 'medium' : 'low');
