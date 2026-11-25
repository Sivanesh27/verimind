import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import GoogleButton from '../../components/auth/GoogleButton.jsx';
import { ErrorBanner } from '../../components/ui/Badges.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { email } = await api('/api/auth/register', { method: 'POST', body: form, auth: false });
      navigate('/verify', { state: { email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function google(credential) {
    try {
      signIn(await api('/api/auth/google', { method: 'POST', body: { credential }, auth: false }));
      navigate('/agent', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="We'll email you a 6-digit code to verify it." footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
      <ErrorBanner error={error} />
      <form className="form" onSubmit={submit}>
        <label>Name<input required maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><span className="muted small">At least 8 characters</span></label>
        <button className="btn primary full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <GoogleButton onCredential={google} />
    </AuthShell>
  );
}
