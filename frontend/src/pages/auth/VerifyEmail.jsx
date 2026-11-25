import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { ErrorBanner } from '../../components/ui/Badges.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function VerifyEmail() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.email ? `We sent a code to ${location.state.email}.` : '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      signIn(await api('/api/auth/verify-email', { method: 'POST', body: { email, code }, auth: false }));
      navigate('/agent', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    try {
      await api('/api/auth/resend-code', { method: 'POST', body: { email, purpose: 'verify' }, auth: false });
      setInfo('A new code is on its way.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthShell title="Verify your email" subtitle={info} footer={<Link to="/login">Back to sign in</Link>}>
      <ErrorBanner error={error} />
      <form className="form" onSubmit={submit}>
        {!location.state?.email && <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
        <label>6-digit code<input className="code-input" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <button className="btn primary full" disabled={busy}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
      </form>
      <button className="link-btn small" onClick={resend} disabled={!email}>Resend code</button>
    </AuthShell>
  );
}
