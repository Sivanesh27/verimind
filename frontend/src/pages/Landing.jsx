import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STAGES = [
  { n: 1, title: 'Process query', text: 'Analyse ambiguity, domain and stakes before answering.' },
  { n: 2, title: 'Estimate confidence', text: 'Self-assessment, self-consistency, evidence, source reliability and tool checks.' },
  { n: 3, title: 'Route decision', text: 'High → answer. Medium → verify & re-evaluate. Low → clarify, specialist or human.' },
  { n: 4, title: 'Explain', text: 'Missing information, conflicting evidence, ambiguity, failed verification — in plain words.' },
  { n: 5, title: 'Monitor & evaluate', text: 'Live dashboards, audit trail, calibration and baseline comparisons.' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <div className="row">
          <ThemeToggle />
          {user ? <Link className="btn primary" to="/agent">Open app</Link> : (
            <>
              <Link className="btn ghost" to="/login">Sign in</Link>
              <Link className="btn primary" to="/register">Get started</Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <span className="eyebrow">Trust-aware AI agent</span>
        <h1>AI that knows <em>when to verify</em>.</h1>
        <p className="lead">
          VeriMind estimates how confident it is in every answer — and acts on it. Confident? It answers.
          Unsure? It searches, runs a tool, asks you, consults a specialist, or escalates to a human. And it always tells you why.
        </p>
        <div className="row center">
          <Link className="btn primary lg" to={user ? '/agent' : '/register'}>Try the agent</Link>
          <Link className="btn ghost lg" to={user ? '/evaluation' : '/login'}>See the evaluation</Link>
        </div>
      </section>

      <section className="stages">
        {STAGES.map((s) => (
          <div key={s.n} className="card stage">
            <span className="stage-n">{s.n}</span>
            <h3>{s.title}</h3>
            <p className="muted">{s.text}</p>
          </div>
        ))}
      </section>

      <footer className="landing-footer muted small">VeriMind · Confidence estimation for reliable decision making</footer>
    </div>
  );
}
