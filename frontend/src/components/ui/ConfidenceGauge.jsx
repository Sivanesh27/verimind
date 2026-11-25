import { confidenceTone } from '../../lib/format.js';

/** Semi-circular gauge. Thresholds are drawn as ticks so users see why a route was chosen. */
export default function ConfidenceGauge({ value = 0, size = 140, thresholds = { medium: 0.55, high: 0.8 } }) {
  const r = 52;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  const tick = (t) => {
    const a = Math.PI * (1 - t);
    return { x1: 60 + 44 * Math.cos(a), y1: 60 - 44 * Math.sin(a), x2: 60 + 60 * Math.cos(a), y2: 60 - 60 * Math.sin(a) };
  };
  return (
    <svg viewBox="0 0 120 70" width={size} height={size * 0.58} className={`gauge tone-${confidenceTone(value)}`} role="img" aria-label={`Confidence ${Math.round(v * 100)}%`}>
      <path d="M8 60 A52 52 0 0 1 112 60" className="gauge-track" />
      <path d="M8 60 A52 52 0 0 1 112 60" className="gauge-value" strokeDasharray={`${c * v} ${c}`} />
      {[thresholds.medium, thresholds.high].map((t) => <line key={t} {...tick(t)} className="gauge-tick" />)}
      <text x="60" y="56" textAnchor="middle" className="gauge-text">{Math.round(v * 100)}%</text>
    </svg>
  );
}
