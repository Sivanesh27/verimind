import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import Logo from '../ui/Logo.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

const NAV = [
  { to: '/agent', label: 'Agent', icon: '◆' },
  { to: '/history', label: 'History', icon: '☰' },
  { to: '/monitor', label: 'Monitor', icon: '◔' },
  { to: '/evaluation', label: 'Evaluation', icon: '⚖' },
  { to: '/review', label: 'Review queue', icon: '⚑', staff: true },
  { to: '/admin', label: 'Users', icon: '⚙', admin: true },
];

export default function AppLayout() {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const { connected } = useSocket();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn menu-btn" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>☰</button>
        <Logo />
        <span className={`live-dot ${connected ? 'on' : ''}`} title={connected ? 'Realtime connected' : 'Reconnecting…'}>
          {connected ? 'Live' : 'Offline'}
        </span>
        <ThemeToggle />
      </header>

      <aside className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="sidebar-brand"><Logo /></div>
        <nav>
          {NAV.filter((n) => (!n.staff || isStaff) && (!n.admin || isAdmin)).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon" aria-hidden>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="row between sidebar-theme">
            <span className="muted small">Theme</span>
            <ThemeToggle />
          </div>
          <div className="user-chip">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>}
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="muted small">{user?.role}</div>
            </div>
          </div>
          <button className="btn ghost full" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
