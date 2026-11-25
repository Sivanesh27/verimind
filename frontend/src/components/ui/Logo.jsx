import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo">
      <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--accent)" />
        <path d="M32 12l16 6v12c0 11-7 19-16 22-9-3-16-11-16-22V18z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
        <path d="M24 32l6 6 11-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>VeriMind</span>
    </Link>
  );
}
