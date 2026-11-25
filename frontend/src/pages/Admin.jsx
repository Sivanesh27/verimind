import { useEffect, useState } from 'react';
import { ErrorBanner, Spinner } from '../components/ui/Badges.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Admin() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/users').then((d) => setUsers(d.users)).catch((e) => setError(e.message));
  }, []);

  async function changeRole(id, role) {
    setError('');
    try {
      const { user } = await api(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } });
      setUsers((us) => us.map((u) => (u.id === id ? user : u)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted">Reviewers handle escalations; admins can also run evaluations and manage roles.</p>
        </div>
      </div>
      <ErrorBanner error={error} />
      {!users ? <Spinner /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Verified</th><th>Joined</th><th>Role</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.email_verified ? '✓' : '—'}</td>
                  <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <select value={u.role} disabled={u.id === me.id} onChange={(e) => changeRole(u.id, e.target.value)} aria-label={`Role for ${u.name}`}>
                      <option value="user">user</option>
                      <option value="reviewer">reviewer</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
