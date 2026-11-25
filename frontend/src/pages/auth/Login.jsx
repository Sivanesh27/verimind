import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import GoogleButton from '../../components/auth/GoogleButton.jsx';
import { ErrorBanner } from '../../components/ui/Badges.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = location.state?.from || '/agent';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      signIn(await api('/api/auth/login', { method: 'POST', body: form, auth: false }));
      navigate(next, { replace: true });
    } catch (err) {
      if (err.details?.code === 'EMAIL_NOT_VERIFIED') navigate('/verify', { state: { email: err.details.email } });
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function google(credential) {
    setError('');
    try {
      signIn(await api('/api/auth/google', { method: 'POST', body: { credential }, auth: false }));
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to talk to an AI that knows when it doesn't know."
      footer={<>New here? <Link to="/register">Create an account</Link></>}
    >
      <ErrorBanner error={error} />
      <form className="form" onSubmit={submit}>
        <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <div className="form-row-end"><Link to="/forgot-password" className="small">Forgot password?</Link></div>
        <button className="btn primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <GoogleButton onCredential={google} />
    </AuthShell>
  );
}
