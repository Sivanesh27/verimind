import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { ErrorBanner } from '../../components/ui/Badges.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ForgotPassword() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [form, setForm] = useState({ email: '', code: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (step === 'request') {
        await api('/api/auth/forgot-password', { method: 'POST', body: { email: form.email }, auth: false });
        setStep('reset');
      } else {
        signIn(await api('/api/auth/reset-password', { method: 'POST', body: form, auth: false }));
        navigate('/agent', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={step === 'request' ? 'Enter your email and we will send you a reset code.' : `If ${form.email} has an account, a code is on its way.`}
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <ErrorBanner error={error} />
      <form className="form" onSubmit={submit}>
        {step === 'request' ? (
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        ) : (
          <>
            <label>6-digit code<input className="code-input" inputMode="numeric" maxLength={6} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })} /></label>
            <label>New password<input type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          </>
        )}
        <button className="btn primary full" disabled={busy}>{busy ? 'Please wait…' : step === 'request' ? 'Send code' : 'Reset password'}</button>
      </form>
    </AuthShell>
  );
}
