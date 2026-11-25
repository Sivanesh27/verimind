import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Renders the official "Continue with Google" button (Google Identity Services). */
export default function GoogleButton({ onCredential }) {
  const ref = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const { theme } = useTheme();
  const [ready, setReady] = useState(!!window.google?.accounts?.id);

  useEffect(() => {
    if (ready || !CLIENT_ID) return undefined;
    const t = setInterval(() => window.google?.accounts?.id && setReady(true), 200);
    return () => clearInterval(t);
  }, [ready]);

  useEffect(() => {
    if (!ready || !CLIENT_ID || !ref.current) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (resp) => cb.current(resp.credential),
    });
    ref.current.innerHTML = '';
    window.google.accounts.id.renderButton(ref.current, {
      theme: theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
    });
  }, [ready, theme]);

  if (!CLIENT_ID) return null;
  return (
    <>
      <div className="divider"><span>or</span></div>
      <div className="google-btn" ref={ref} />
    </>
  );
}
