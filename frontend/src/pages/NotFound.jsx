import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center-page">
      <div className="empty">
        <h1>404</h1>
        <p className="muted">I'm confident this page doesn't exist.</p>
        <Link className="btn primary" to="/">Go home</Link>
      </div>
    </div>
  );
}
