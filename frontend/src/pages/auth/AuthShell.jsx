import Logo from '../../components/ui/Logo.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <ThemeToggle />
      <div className="auth-card">
        <Logo />
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
        {footer && <div className="auth-footer muted small">{footer}</div>}
      </div>
    </div>
  );
}
